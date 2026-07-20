"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import CollapsibleOrderPanel from "@/components/orders/new-order/CollapsibleOrderPanel";
import NewOrderField, {
  CheckboxOption,
  RadioOption,
} from "@/components/orders/new-order/NewOrderField";
import PaymentChargeCard from "@/components/orders/new-order/PaymentChargeCard";
import ProviderSearchField from "@/components/orders/new-order/ProviderSearchField";
import FacilitySearchField from "@/components/orders/new-order/FacilitySearchField";
import DoctorSearchField from "@/components/orders/new-order/DoctorSearchField";
import DoctorAddressSearchField from "@/components/orders/new-order/DoctorAddressSearchField";
import SubpoenaPreviewContent from "@/components/orders/new-order/SubpoenaPreviewContent";
import SubpoenaExtractionOverlay from "@/components/orders/new-order/SubpoenaExtractionOverlay";
import CertificateNoRecordsPanel from "@/components/orders/new-order/CertificateNoRecordsPanel";
import RecordTypeMultiSelect from "@/components/orders/new-order/RecordTypeMultiSelect";

import {
  formatMoneyInput,
  formatPhone,
  formatSSN,
  immediateRequiredFields,
  moneyFields,
  numericOnlyFields,
  phoneFields,
  validateFile,
  validateNewOrderForm,
} from "@/lib/validations/newOrderValidation";

import {
  OrderIcon,
  PaymentIcon,
  SaveIcon,
  ServeIcon,
  SubpoenaIcon,
} from "@/components/icons/NewOrderIcons";

import { createOrder, getOrder, updateOrder, updateOrderFacility, getUnprocessedSubpoenaById, fetchUnprocessedSubpoenaPdf, fetchOrderSubpoenaPdf, uploadSingleSubpoena } from "@/lib/orders/orderApi";
import { getFacilities } from "@/lib/facilities/facilityApi";
import {
  clearDraftOrderSession,
  getDraftOrderScope,
  hasDraftableOrderContent,
  isSameFacilityLabel,
  readDraftOrderSession,
  rememberDraftOrderSession,
  resolvePendingFacility,
  serializeFormForDraft,
} from "@/lib/orders/facilityOrderUtils";
import {
  resolvePendingDoctorForOrder,
} from "@/lib/orders/doctorOrderUtils";
import { getProviders, updateProvider } from "@/lib/providers/providerApi";
import { buildFormFromExtract } from "@/lib/orders/extractionFormUtils";
import { syncPaymentDueFields, validateOrderPaymentAmounts } from "@/lib/orders/paymentUtils";
import { API_BASE_URL } from "@/config/api";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";

function toFileUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function subpoenaFileName(path) {
  if (!path) return "Subpoena";
  return path.split("/").pop() || "Subpoena";
}

const PROVIDER_SYNC_FIELDS = new Set([
  "address",
  "zip",
  "city",
  "state",
  "phone",
  "fax",
  "email",
]);

const initialFormData = {
  facility: "",
  facilityName: "",
  providerId: "",
  type: "",
  caseNumber: "",
  ssn: "",
  dob: "",

  firstName: "",
  middleName: "",
  lastName: "",
  aka: "",
  defendant: "",
  injuryType: "",
  injuryDate: "",
  injuryDateBegin: "",
  injuryDateEnd: "",

  documentName: "",
  subpoenaFile: null,
  subpoenaExtractId: "",
  additionalDocumentFile: null,

  orderNumber: "",
  recNumber: "",
  serveCompanyName: "",
  address: "",
  zip: "",
  city: "",
  state: "",
  phone: "",
  fax: "",
  email: "",

  contact1Name: "",
  contact1Title: "",
  contact1Phone: "",
  contact1Fax: "",
  contact1Email: "",

  contact2Name: "",
  contact2Title: "",
  contact2Phone: "",
  contact2Fax: "",
  contact2Email: "",

  dateServed: "",
  depoDueDate: "",
  deliveryDate: "",
  subpoenaDate: "",
  dateRequested: "",
  readyDate: "",
  invoiceDate: "",
  xrayInvoiceDate: "",

  medicalRecords: false,
  billingRecords: false,
  employmentRecords: false,
  xrays: false,
  otherRecord: false,

  specificRecord: "",
  specificDoctor: "",
  specificDoctorId: "",
  specificDoctorIsDefault: false,
  fullAddress: "",

  certificateNoRecords: false,
  cnrReason: "",
  cnrDelivery: "",
  cnrDateSent: "",
  cnrMemo: false,

  prepaymentCheck: "",
  prepaymentDate: "",
  prepaymentPaid: "",
  prepaymentDue: "15.00",
  prepaymentMemo: "",

  custodianCheck: "",
  custodianDate: "",
  custodianPaid: "",
  custodianDue: "0.00",
  custodianMemo: "",

  xrayCheck: "",
  xrayDate: "",
  xrayPaid: "",
  xrayDue: "0",
  xrayMemo: "",
};

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex min-h-[calc(100vh-92px)] items-center justify-center">
            <p className="text-[13px] text-[#64748B]">Loading...</p>
          </div>
        </DashboardShell>
      }
    >
      <NewOrderPageContent />
    </Suspense>
  );
}

function NewOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId");
  const subpoenaId = searchParams.get("subpoenaId");
  const panel = searchParams.get("panel");
  const facilityRefresh = searchParams.get("facilityRefresh");
  const applyFacilityId = searchParams.get("applyFacilityId");
  const returnToParam = searchParams.get("returnTo");

  const isEditMode = Boolean(orderId);

  const resolveListPath = useCallback(
    (creationSource = "") => {
      const normalized = `${returnToParam || ""}`.trim().replace(/^\/+/, "");
      if (
        normalized === "personal-orders" ||
        normalized === "company-orders" ||
        normalized === "reports" ||
        normalized === "orders"
      ) {
        return `/${normalized}`;
      }
      if (creationSource === "personal_portal") return "/personal-orders";
      if (creationSource === "company_portal") return "/company-orders";
      return "/orders";
    },
    [returnToParam]
  );

  const returnToOrderPath = useMemo(() => {
    const params = new URLSearchParams();
    if (orderId) {
      params.set("mode", "edit");
      params.set("orderId", orderId);
    }
    if (subpoenaId) params.set("subpoenaId", subpoenaId);
    if (panel) params.set("panel", panel);
    if (returnToParam) params.set("returnTo", returnToParam);
    const query = params.toString();
    return `/orders/new${query ? `?${query}` : ""}`;
  }, [orderId, subpoenaId, panel, returnToParam]);

  const draftScope = useMemo(
    () => getDraftOrderScope({ orderId, subpoenaId }),
    [orderId, subpoenaId]
  );

  const [expandedPanels, setExpandedPanels] = useState({
    subpoena: false,
    order: true,
    serve: true,
    payment: true,
  });

  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(formData);
  const committedFacilityRef = useRef({ id: "", name: "" });
  const draftRestoredRef = useRef(false);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const setFormDataAndRef = useCallback((updater) => {
    setFormData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      formDataRef.current = next;
      return next;
    });
  }, []);

  const markCommittedFacility = (id, name) => {
    committedFacilityRef.current = {
      id: `${id || ""}`.trim(),
      name: `${name || ""}`.trim(),
    };
  };

  const clearCommittedFacility = () => {
    committedFacilityRef.current = { id: "", name: "" };
  };

  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fileErrors, setFileErrors] = useState({});

  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoadError, setFacilitiesLoadError] = useState("");

  const [loadingOrder, setLoadingOrder] = useState(isEditMode);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [extractingSubpoena, setExtractingSubpoena] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractionMeta, setExtractionMeta] = useState({
    facilityName: "",
    facilityCreated: false,
    extractedDoctorName: "",
    providerName: "",
    providerCreated: false,
  });
  const [facilityProfileIncomplete, setFacilityProfileIncomplete] = useState(false);
  const [facilityCreated, setFacilityCreated] = useState(false);
  const [resolvingFacility, setResolvingFacility] = useState(false);
  const [missingDefaultDoctor, setMissingDefaultDoctor] = useState(false);
  const [doctorCreated, setDoctorCreated] = useState(false);
  const [resolvingDoctor, setResolvingDoctor] = useState(false);
  const [editSubpoenaSrc, setEditSubpoenaSrc] = useState("");
  const extractionMetaRef = useRef(extractionMeta);
  const doctorCreatedRef = useRef(false);

  useEffect(() => {
    extractionMetaRef.current = extractionMeta;
  }, [extractionMeta]);

  useEffect(() => {
    doctorCreatedRef.current = doctorCreated;
  }, [doctorCreated]);

  const persistOrderDraft = useCallback(() => {
    const current = formDataRef.current;
    const existing = readDraftOrderSession(draftScope, { allowIncomplete: true });

    if (!hasDraftableOrderContent(current) && !existing?.facilityId) {
      return;
    }

    rememberDraftOrderSession(draftScope, {
      // Prefer live form values, but never wipe a known facility id with a stale empty ref.
      facilityId: current.facility || existing?.facilityId || "",
      facilityName: current.facilityName || existing?.facilityName || "",
      formSnapshot: serializeFormForDraft({
        ...(existing?.formSnapshot || {}),
        ...current,
        facility: current.facility || existing?.facilityId || existing?.formSnapshot?.facility || "",
        facilityName:
          current.facilityName ||
          existing?.facilityName ||
          existing?.formSnapshot?.facilityName ||
          "",
      }),
      extractionMeta: {
        ...extractionMetaRef.current,
        doctorCreated: doctorCreatedRef.current,
      },
    });
  }, [draftScope]);

  useEffect(() => {
    if (!hasDraftableOrderContent(formData)) {
      return undefined;
    }

    const timer = setTimeout(() => {
      persistOrderDraft();
    }, 400);

    return () => clearTimeout(timer);
  }, [formData, persistOrderDraft]);

  useEffect(() => {
    return () => {
      persistOrderDraft();
    };
  }, [persistOrderDraft]);

  const clearFacilityRefreshParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("facilityRefresh");
    params.delete("applyFacilityId");
    const query = params.toString();
    router.replace(`/orders/new${query ? `?${query}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  const restoreOrderDraftAfterFacilityReturn = useCallback(async () => {
    const draft = readDraftOrderSession(draftScope);
    if (!draft?.formSnapshot && !draft?.facilityId) {
      return false;
    }

    let resolved = {
      facilityId: draft.facilityId || draft.formSnapshot?.facility || "",
      facilityName: draft.facilityName || draft.formSnapshot?.facilityName || "",
      facilityProfileIncomplete: false,
      facilityCreated: false,
    };

    if (resolved.facilityId || resolved.facilityName) {
      try {
        resolved = await resolvePendingFacility({
          facilityId: resolved.facilityId,
          facilityName: resolved.facilityName,
        });
      } catch {
        // Keep the facility details already stored in the draft.
      }
    }

    let nextForm = {
      ...(draft.formSnapshot || {}),
      facility: resolved.facilityId || draft.formSnapshot?.facility || "",
      facilityName: resolved.facilityName || draft.formSnapshot?.facilityName || "",
    };

    let doctorResolved = null;
    const extractedDoctorName = `${draft.extractionMeta?.extractedDoctorName || ""}`.trim();

    if (resolved.facilityId || nextForm.facility) {
      try {
        doctorResolved = await resolvePendingDoctorForOrder({
          facilityId: resolved.facilityId || nextForm.facility,
          doctorId:
            nextForm.specificDoctorId || draft.formSnapshot?.specificDoctorId || "",
          doctorName: nextForm.specificDoctor || extractedDoctorName,
          extractedDoctorName,
          priorDoctorCreated: Boolean(draft.extractionMeta?.doctorCreated),
        });
        nextForm = {
          ...nextForm,
          specificDoctor: doctorResolved.specificDoctor,
          specificDoctorId: doctorResolved.specificDoctorId,
          specificDoctorIsDefault: doctorResolved.specificDoctorIsDefault,
        };
        setMissingDefaultDoctor(doctorResolved.missingDefaultDoctor);
        setDoctorCreated(doctorResolved.doctorCreated);
      } catch {
        // Keep the doctor already stored in the draft.
      }
    }

    const activeSubpoenaId =
      `${subpoenaId || nextForm.subpoenaExtractId || ""}`.trim();
    if (activeSubpoenaId && !nextForm.subpoenaFile) {
      try {
        const [blob, extract] = await Promise.all([
          fetchUnprocessedSubpoenaPdf(activeSubpoenaId),
          getUnprocessedSubpoenaById(activeSubpoenaId),
        ]);
        nextForm.subpoenaFile = new File(
          [blob],
          extract?.fileName || "subpoena.pdf",
          { type: "application/pdf" }
        );
      } catch {
        // Prefill can still proceed without the PDF attachment.
      }
    }

    setFormData(nextForm);
    markCommittedFacility(resolved.facilityId, resolved.facilityName);
    setFacilityProfileIncomplete(resolved.facilityProfileIncomplete);
    setFacilityCreated(resolved.facilityCreated);
    if (draft.extractionMeta) {
      setExtractionMeta(draft.extractionMeta);
    } else {
      setExtractionMeta((prev) => ({
        ...prev,
        facilityName: resolved.facilityName,
        facilityCreated: resolved.facilityCreated,
      }));
    }
    if (doctorResolved) {
      setMissingDefaultDoctor(doctorResolved.missingDefaultDoctor);
      setDoctorCreated(doctorResolved.doctorCreated);
    }
    setExpandedPanels((prev) => ({
      ...prev,
      subpoena: Boolean(nextForm.subpoenaFile),
      order: true,
    }));

    rememberDraftOrderSession(draftScope, {
      facilityId: resolved.facilityId,
      facilityName: resolved.facilityName,
      formSnapshot: serializeFormForDraft(nextForm),
      extractionMeta: draft.extractionMeta || extractionMetaRef.current,
    });

    if (resolved.facilityId) {
      setFacilities((prev) => {
        if (prev.some((item) => String(item.id) === String(resolved.facilityId))) {
          return prev;
        }
        return [
          {
            id: Number(resolved.facilityId),
            facility: resolved.facilityName,
          },
          ...prev,
        ];
      });
    }

    draftRestoredRef.current = true;
    return true;
  }, [draftScope, subpoenaId]);

  useEffect(() => {
    let active = true;

    getFacilities()
      .then((facilityList) => {
        if (!active) return;
        setFacilities(facilityList);
        setFacilitiesLoadError("");
      })
      .catch((err) => {
        if (active) {
          setFacilities([]);
          setFacilitiesLoadError(
            getApiErrorMessage(err, "Failed to load facilities")
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!isEditMode || !orderId) {
      if (!subpoenaId && facilityRefresh !== "1") {
        if (!draftRestoredRef.current) {
          setFormData(initialFormData);
          setTouched({});
          setSubmitAttempted(false);
          setFileErrors({});
          clearDraftOrderSession(draftScope);
        }
      }
      if (!isEditMode && !subpoenaId && facilityRefresh !== "1") {
        setLoadingOrder(false);
      }
      return undefined;
    }

    setLoadingOrder(true);
    setLoadError("");

    getOrder(orderId)
      .then(async (order) => {
        if (!active) return;

        if (!order) {
          setLoadError("Order not found");
          return;
        }

        const isReturnFromFacilityEdit = facilityRefresh === "1";
        const draftFacility = readDraftOrderSession(draftScope);
        const draftFacilityId = `${
          draftFacility?.facilityId || draftFacility?.formSnapshot?.facility || ""
        }`.trim();
        const orderFacilityId = `${order.facility || ""}`.trim();
        // Restore draft when returning from facility profile, or when an unsaved
        // facility change is still pending for this order.
        const shouldRestoreDraft = Boolean(
          ((isReturnFromFacilityEdit || applyFacilityId) &&
            (draftFacility?.formSnapshot || draftFacility?.facilityId)) ||
            (draftFacilityId && draftFacilityId !== orderFacilityId)
        );

        let nextForm = syncPaymentDueFields(
          { ...initialFormData, ...order },
          order.invoiceFees
        );
        let profileIncomplete = Boolean(order.facilityProfileIncomplete);
        let facilityWasCreated = Boolean(order.facilityIsAutoCreated);
        let facilityLabel = order.facilityName || "";

        if (shouldRestoreDraft) {
          if (draftFacility.formSnapshot) {
            nextForm = syncPaymentDueFields(
              { ...nextForm, ...draftFacility.formSnapshot },
              order.invoiceFees
            );
          }

          try {
            const resolved = await resolvePendingFacility({
              facilityId:
                applyFacilityId ||
                draftFacility.facilityId ||
                draftFacility.formSnapshot?.facility,
              facilityName:
                draftFacility.facilityName ||
                draftFacility.formSnapshot?.facilityName,
            });

            nextForm = {
              ...nextForm,
              facility: resolved.facilityId || nextForm.facility,
              facilityName: resolved.facilityName || nextForm.facilityName,
            };
            profileIncomplete = resolved.facilityProfileIncomplete;
            facilityWasCreated = resolved.facilityCreated;
            facilityLabel = resolved.facilityName || nextForm.facilityName;

            rememberDraftOrderSession(draftScope, {
              facilityId: resolved.facilityId || nextForm.facility,
              facilityName: resolved.facilityName || nextForm.facilityName,
              formSnapshot: serializeFormForDraft(nextForm),
              extractionMeta: draftFacility.extractionMeta || extractionMetaRef.current,
            });

            try {
              const extractedDoctorName = `${draftFacility.extractionMeta?.extractedDoctorName || ""}`.trim();
              const doctorResolved = await resolvePendingDoctorForOrder({
                facilityId: resolved.facilityId || nextForm.facility,
                doctorId:
                  nextForm.specificDoctorId ||
                  draftFacility.formSnapshot?.specificDoctorId ||
                  "",
                doctorName: nextForm.specificDoctor || extractedDoctorName,
                extractedDoctorName,
                priorDoctorCreated: Boolean(draftFacility.extractionMeta?.doctorCreated),
              });
              nextForm = {
                ...nextForm,
                specificDoctor: doctorResolved.specificDoctor,
                specificDoctorId: doctorResolved.specificDoctorId,
                specificDoctorIsDefault: doctorResolved.specificDoctorIsDefault,
              };
              if (active) {
                setMissingDefaultDoctor(doctorResolved.missingDefaultDoctor);
                setDoctorCreated(doctorResolved.doctorCreated);
              }
            } catch {
              // Keep the doctor already stored on the order.
            }
          } catch {
            // Keep the facility already stored on the order/draft.
          }
        } else if (applyFacilityId) {
          try {
            const resolved = await resolvePendingFacility({
              facilityId: applyFacilityId,
            });
            nextForm = {
              ...nextForm,
              facility: resolved.facilityId || nextForm.facility,
              facilityName: resolved.facilityName || nextForm.facilityName,
            };
            profileIncomplete = resolved.facilityProfileIncomplete;
            facilityWasCreated = resolved.facilityCreated;
            facilityLabel = resolved.facilityName || nextForm.facilityName;
          } catch {
            // Keep order facility.
          }
        } else if (!isReturnFromFacilityEdit) {
          // No pending facility change — drop stale draft for a clean load.
          clearDraftOrderSession(draftScope);
        }

        if (!active) return;

        if (isReturnFromFacilityEdit || applyFacilityId) {
          draftRestoredRef.current = true;
          clearFacilityRefreshParam();
        }

        if (nextForm.facility && !`${nextForm.specificDoctor || ""}`.trim()) {
          try {
            const doctorResolved = await resolvePendingDoctorForOrder({
              facilityId: nextForm.facility,
              doctorId: nextForm.specificDoctorId || "",
            });
            nextForm = {
              ...nextForm,
              specificDoctor: doctorResolved.specificDoctor,
              specificDoctorId: doctorResolved.specificDoctorId,
              specificDoctorIsDefault: doctorResolved.specificDoctorIsDefault,
            };
            if (active) {
              setMissingDefaultDoctor(doctorResolved.missingDefaultDoctor);
              setDoctorCreated(doctorResolved.doctorCreated);
            }
          } catch {
            if (active) setMissingDefaultDoctor(false);
          }
        } else if (active) {
          setMissingDefaultDoctor(false);
        }

        setFormDataAndRef(nextForm);
        markCommittedFacility(nextForm.facility, nextForm.facilityName);
        setFacilityProfileIncomplete(profileIncomplete);
        setFacilityCreated(facilityWasCreated);
        if (isReturnFromFacilityEdit && draftFacility?.extractionMeta) {
          setExtractionMeta(draftFacility.extractionMeta);
        } else {
          setExtractionMeta((prev) => ({
            ...prev,
            facilityName: facilityLabel,
            facilityCreated: facilityWasCreated,
          }));
        }
        setTouched({});
        setSubmitAttempted(false);
        setFileErrors({});
      })
      .catch((err) => {
        if (active) setLoadError(err.message || "Failed to load order");
      })
      .finally(() => {
        if (active) setLoadingOrder(false);
      });

    return () => {
      active = false;
    };
  }, [isEditMode, orderId, subpoenaId, facilityRefresh, applyFacilityId, draftScope, clearFacilityRefreshParam, setFormDataAndRef]);

  useEffect(() => {
    if (isEditMode || facilityRefresh !== "1") {
      return undefined;
    }

    let active = true;

    (async () => {
      setLoadingOrder(true);
      setLoadError("");

      try {
        const restored = await restoreOrderDraftAfterFacilityReturn();
        if (!active) return;

        if (!restored && subpoenaId) {
          const facilityList = facilities.length ? facilities : await getFacilities();
          const providerList = await getProviders();
          if (!active) return;

          if (!facilities.length) {
            setFacilities(facilityList);
          }

          const extract = await getUnprocessedSubpoenaById(subpoenaId);
          if (!active) return;

          if (extract) {
            let subpoenaFile = null;
            try {
              const blob = await fetchUnprocessedSubpoenaPdf(subpoenaId);
              subpoenaFile = new File(
                [blob],
                extract.fileName || "subpoena.pdf",
                { type: "application/pdf" }
              );
            } catch {
              // Prefill can still proceed without the PDF attachment.
            }

            const { formUpdates, meta } = buildFormFromExtract(
              extract,
              { facilityList, providerList },
              subpoenaFile
            );

            await applyExtractFormUpdates(formUpdates, meta, subpoenaFile, {
              reset: true,
            });
            setExpandedPanels((prev) => ({
              ...prev,
              subpoena: Boolean(subpoenaFile),
              order: true,
            }));
          } else {
            setLoadError("Could not restore your in-progress order.");
          }
        } else if (!restored) {
          setLoadError(
            "Could not restore your in-progress order. Please re-open it from the orders list or re-upload the subpoena."
          );
        }

        clearFacilityRefreshParam();
        setTouched({});
        setSubmitAttempted(false);
        setFileErrors({});
      } catch (err) {
        if (active) {
          setLoadError(err.message || "Failed to restore order after facility update");
        }
      } finally {
        if (active) setLoadingOrder(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    isEditMode,
    facilityRefresh,
    restoreOrderDraftAfterFacilityReturn,
    clearFacilityRefreshParam,
    subpoenaId,
    facilities,
  ]);

  useEffect(() => {
    if (!isEditMode) return;

    if (panel === "upload") {
      setExpandedPanels((prev) => ({
        ...prev,
        order: true,
      }));
      return;
    }

    if (panel === "payment") {
      setExpandedPanels((prev) => ({
        ...prev,
        payment: true,
      }));
    }
  }, [panel, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !orderId) return undefined;

    let active = true;

    async function refreshInvoiceFees() {
      try {
        const order = await getOrder(orderId);
        if (!active || !order) return;

        setFormData((prev) =>
          syncPaymentDueFields(
            {
              ...prev,
              invoiceFees: order.invoiceFees || prev.invoiceFees,
            },
            order.invoiceFees || prev.invoiceFees
          )
        );
      } catch {
        // Payment charges can still use the last loaded invoice snapshot.
      }
    }

    if (panel === "payment") {
      refreshInvoiceFees();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && panel === "payment") {
        refreshInvoiceFees();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isEditMode, orderId, panel]);

  useEffect(() => {
    if (!isEditMode || !orderId || !expandedPanels.payment) {
      return undefined;
    }

    let active = true;

    async function refreshPaymentDues() {
      try {
        const order = await getOrder(orderId);
        if (!active || !order) return;

        setFormData((prev) =>
          syncPaymentDueFields(
            {
              ...prev,
              invoiceFees: order.invoiceFees || prev.invoiceFees,
            },
            order.invoiceFees || prev.invoiceFees
          )
        );
      } catch {
        // Keep the last loaded payment snapshot.
      }
    }

    refreshPaymentDues();

    return () => {
      active = false;
    };
  }, [isEditMode, orderId, expandedPanels.payment]);

  useEffect(() => {
    if (!isEditMode || !orderId) {
      setEditSubpoenaSrc("");
      return undefined;
    }

    if (!formData.subpoenaStoragePath || formData.subpoenaFile) {
      setEditSubpoenaSrc("");
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    (async () => {
      try {
        const blob = await fetchOrderSubpoenaPdf(orderId);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setEditSubpoenaSrc(objectUrl);
      } catch {
        if (active) {
          setEditSubpoenaSrc(formData.subpoenaUrl ? toFileUrl(formData.subpoenaUrl) : "");
        }
      }
    })();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isEditMode, orderId, formData.subpoenaStoragePath, formData.subpoenaFile, formData.subpoenaUrl]);

  useEffect(() => {
    if (
      isEditMode ||
      !subpoenaId ||
      facilityRefresh === "1" ||
      draftRestoredRef.current
    ) {
      return undefined;
    }

    let active = true;

    setLoadingOrder(true);
    setLoadError("");

    (async () => {
      try {
        const facilityList = facilities.length ? facilities : await getFacilities();
        const providerList = await getProviders();
        if (!active) return;

        if (!facilities.length) {
          setFacilities(facilityList);
        }

        const extract = await getUnprocessedSubpoenaById(subpoenaId);
        if (!active) return;

        if (!extract) {
          setLoadError("Subpoena extract not found");
          return;
        }

        let subpoenaFile = null;
        try {
          const blob = await fetchUnprocessedSubpoenaPdf(subpoenaId);
          subpoenaFile = new File(
            [blob],
            extract.fileName || "subpoena.pdf",
            { type: "application/pdf" }
          );
        } catch {
          // Prefill can still proceed without the PDF attachment.
        }

        const { formUpdates, meta } = buildFormFromExtract(
          extract,
          { facilityList, providerList },
          subpoenaFile
        );

        await applyExtractFormUpdates(formUpdates, meta, subpoenaFile, {
          reset: true,
        });
        setTouched({});
        setSubmitAttempted(false);
        setFileErrors({});
        setExpandedPanels((prev) => ({
          ...prev,
          subpoena: Boolean(subpoenaFile),
          order: true,
        }));
      } catch (err) {
        if (active) {
          setLoadError(err.message || "Failed to load subpoena extract");
        }
      } finally {
        if (active) setLoadingOrder(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isEditMode, subpoenaId]);

  const applyExtractFormUpdates = async (
    formUpdates,
    meta,
    subpoenaFile = null,
    { reset = false } = {}
  ) => {
    let nextUpdates = { ...formUpdates };
    let nextMeta = { ...meta };

    if (formUpdates.facility) {
      setFacilityProfileIncomplete(Boolean(meta.facilityProfileIncomplete));
      setFacilityCreated(Boolean(meta.facilityCreated));
      markCommittedFacility(
        formUpdates.facility,
        formUpdates.facilityName || meta.facilityName || ""
      );

      if (formUpdates.facility) {
        setFacilities((prev) => {
          if (prev.some((item) => String(item.id) === String(formUpdates.facility))) {
            return prev;
          }
          return [
            {
              id: Number(formUpdates.facility),
              facility: formUpdates.facilityName || meta.facilityName || "",
            },
            ...prev,
          ];
        });
      }
    }

    const unresolvedFacilityName =
      !formUpdates.facility &&
      `${meta.pendingFacilityName || formUpdates.facilityName || ""}`.trim();

    if (unresolvedFacilityName) {
      const resolved = await resolvePendingFacility({
        facilityName: unresolvedFacilityName,
        address: meta.facilityAddress || "",
        city: meta.facilityCity || "",
        state: meta.facilityState || "",
        zip: meta.facilityZip || "",
      });
      nextUpdates = {
        ...nextUpdates,
        facility: resolved.facilityId,
        facilityName: resolved.facilityName,
      };
      nextMeta = {
        ...nextMeta,
        facilityName: resolved.facilityName,
        facilityCreated: resolved.facilityCreated,
        pendingFacilityName: "",
      };
      setFacilityProfileIncomplete(resolved.facilityProfileIncomplete);
      setFacilityCreated(resolved.facilityCreated);
      markCommittedFacility(resolved.facilityId, resolved.facilityName);

      if (resolved.facilityId) {
        setFacilities((prev) => {
          if (prev.some((item) => String(item.id) === String(resolved.facilityId))) {
            return prev;
          }
          return [
            {
              id: Number(resolved.facilityId),
              facility: resolved.facilityName,
            },
            ...prev,
          ];
        });
      }
    }

    const facilityIdForDoctor = `${nextUpdates.facility || formUpdates.facility || ""}`.trim();
    if (facilityIdForDoctor) {
      if (nextMeta.missingDefaultDoctor) {
        nextUpdates = {
          ...nextUpdates,
          specificDoctor: "",
          specificDoctorId: "",
          specificDoctorIsDefault: false,
        };
        setMissingDefaultDoctor(true);
        setDoctorCreated(Boolean(nextMeta.doctorCreated));
      } else {
        const doctorName =
          nextUpdates.specificDoctor ||
          formUpdates.specificDoctor ||
          nextMeta.extractedDoctorName ||
          "";

        try {
          const doctorResolved = await resolvePendingDoctorForOrder({
            facilityId: facilityIdForDoctor,
            doctorId:
              nextUpdates.specificDoctorId ||
              formUpdates.specificDoctorId ||
              "",
            doctorName,
            extractedDoctorName: nextMeta.extractedDoctorName,
            priorDoctorCreated: Boolean(nextMeta.doctorCreated),
          });
          nextUpdates = {
            ...nextUpdates,
            specificDoctor: doctorResolved.specificDoctor,
            specificDoctorId: doctorResolved.specificDoctorId,
            specificDoctorIsDefault: doctorResolved.specificDoctorIsDefault,
          };
          setMissingDefaultDoctor(doctorResolved.missingDefaultDoctor);
          setDoctorCreated(doctorResolved.doctorCreated);
        } catch {
          setMissingDefaultDoctor(false);
          setDoctorCreated(false);
        }
      }
    }

    setFormData((prev) => ({
      ...(reset ? initialFormData : prev),
      ...nextUpdates,
      ...(subpoenaFile ? { subpoenaFile } : {}),
    }));
    setExtractionMeta((prev) => ({ ...prev, ...nextMeta }));

    const draftFacilityId = `${nextUpdates.facility || formUpdates.facility || ""}`.trim();
    if (draftFacilityId) {
      rememberDraftOrderSession(draftScope, {
        facilityId: draftFacilityId,
        facilityName:
          nextUpdates.facilityName ||
          formUpdates.facilityName ||
          nextMeta.facilityName ||
          "",
        formSnapshot: serializeFormForDraft({
          ...(reset ? initialFormData : formDataRef.current),
          ...nextUpdates,
          ...(subpoenaFile ? { subpoenaExtractId: nextUpdates.subpoenaExtractId } : {}),
        }),
        extractionMeta: { ...extractionMetaRef.current, ...nextMeta },
      });
    }
  };

  const errors = useMemo(
    () => ({
      ...validateNewOrderForm(formData, fileErrors),
      ...validateOrderPaymentAmounts(formData, formData.invoiceFees),
      ...apiFieldErrors,
    }),
    [formData, fileErrors, apiFieldErrors]
  );

  const hasImmediateRequiredErrors = immediateRequiredFields.some(
    (field) => errors[field]
  );

  const hasValidationErrors = Object.values(errors).some(Boolean);

  const syncDoctorFromForm = async (data, options = {}) => {
    const facilityId = `${data.facility || ""}`.trim();

    if (!facilityId) {
      setMissingDefaultDoctor(false);
      setDoctorCreated(false);
      return null;
    }

    const doctorName = `${options.doctorName ?? data.specificDoctor ?? ""}`.trim();
    const extractedDoctorName = `${options.extractedDoctorName ?? ""}`.trim();
    const nameToResolve = options.resetForFacilityChange
      ? ""
      : doctorName || extractedDoctorName;

    setResolvingDoctor(true);

    try {
      const resolved = await resolvePendingDoctorForOrder({
        facilityId,
        doctorId: options.resetForFacilityChange ? "" : data.specificDoctorId || "",
        doctorName: nameToResolve,
        extractedDoctorName: options.resetForFacilityChange
          ? ""
          : extractedDoctorName || extractionMetaRef.current?.extractedDoctorName,
        priorDoctorCreated: options.resetForFacilityChange
          ? false
          : Boolean(extractionMetaRef.current?.doctorCreated),
      });

      setFormData((prev) => ({
        ...prev,
        specificDoctor: resolved.specificDoctor,
        specificDoctorId: resolved.specificDoctorId,
        specificDoctorIsDefault: resolved.specificDoctorIsDefault,
      }));
      setMissingDefaultDoctor(resolved.missingDefaultDoctor);
      setDoctorCreated(
        options.resetForFacilityChange ? false : resolved.doctorCreated
      );

      return resolved;
    } finally {
      setResolvingDoctor(false);
    }
  };

  const syncFacilityFromForm = async (data, options = {}) => {
    const facilityName = `${data.facilityName || ""}`.trim();
    const facilityId = `${data.facility || ""}`.trim();
    const previousFacilityId = `${formDataRef.current.facility || ""}`.trim();

    if (!facilityName && !facilityId) {
      setFacilityProfileIncomplete(false);
      setFacilityCreated(false);
      setMissingDefaultDoctor(false);
      setDoctorCreated(false);
      return null;
    }

    setResolvingFacility(true);

    try {
      const resolved = await resolvePendingFacility({
        facilityName,
        facilityId,
      });
      const newFacilityId = `${resolved.facilityId || ""}`.trim();
      const subpoenaFacilityName = `${extractionMetaRef.current.facilityName || ""}`.trim();
      const subpoenaDoctorMismatch =
        Boolean(subpoenaFacilityName) &&
        Boolean(resolved.facilityName) &&
        !isSameFacilityLabel(subpoenaFacilityName, resolved.facilityName) &&
        Boolean(
          data.specificDoctor ||
            data.specificDoctorId ||
            extractionMetaRef.current.extractedDoctorName
        );
      const facilityChanged =
        Boolean(options.facilityChanged) ||
        Boolean(
          previousFacilityId &&
            newFacilityId &&
            previousFacilityId !== newFacilityId
        ) ||
        subpoenaDoctorMismatch;

      setFormDataAndRef((prev) => ({
        ...prev,
        facility: resolved.facilityId,
        facilityName: resolved.facilityName,
        ...(facilityChanged
          ? {
              specificDoctor: "",
              specificDoctorId: "",
              specificDoctorIsDefault: false,
            }
          : {}),
      }));
      markCommittedFacility(resolved.facilityId, resolved.facilityName);
      setFacilityProfileIncomplete(resolved.facilityProfileIncomplete);
      setFacilityCreated(resolved.facilityCreated);

      const keepSubpoenaDoctorContext =
        extractionMetaRef.current.facilityName &&
        isSameFacilityLabel(
          resolved.facilityName,
          extractionMetaRef.current.facilityName
        );

      if (facilityChanged) {
        setExtractionMeta((prev) => ({
          ...prev,
          facilityName: resolved.facilityName,
          facilityCreated: resolved.facilityCreated,
          ...(keepSubpoenaDoctorContext
            ? {}
            : { extractedDoctorName: "", doctorCreated: false }),
        }));
        setDoctorCreated(false);
      } else {
        setExtractionMeta((prev) => ({
          ...prev,
          facilityName: resolved.facilityName,
          facilityCreated: resolved.facilityCreated,
        }));
      }

      if (resolved.facilityId) {
        setFacilities((prev) => {
          if (prev.some((item) => String(item.id) === String(resolved.facilityId))) {
            return prev;
          }
          return [
            {
              id: Number(resolved.facilityId),
              facility: resolved.facilityName,
            },
            ...prev,
          ];
        });
      }

      const doctorResolved = await syncDoctorFromForm(
        {
          ...(facilityChanged
            ? {
                specificDoctor: "",
                specificDoctorId: "",
                specificDoctorIsDefault: false,
              }
            : data),
          facility: resolved.facilityId,
          facilityName: resolved.facilityName,
        },
        facilityChanged
          ? { resetForFacilityChange: true }
          : {
              extractedDoctorName: extractionMetaRef.current?.extractedDoctorName,
            }
      );

      if (resolved.facilityId) {
        rememberDraftOrderSession(draftScope, {
          facilityId: resolved.facilityId,
          facilityName: resolved.facilityName,
          formSnapshot: serializeFormForDraft({
            ...formDataRef.current,
            ...data,
            facility: resolved.facilityId,
            facilityName: resolved.facilityName,
            specificDoctor:
              doctorResolved?.specificDoctor ?? formDataRef.current.specificDoctor,
            specificDoctorId:
              doctorResolved?.specificDoctorId ?? formDataRef.current.specificDoctorId,
            specificDoctorIsDefault:
              doctorResolved?.specificDoctorIsDefault ??
              formDataRef.current.specificDoctorIsDefault,
          }),
          extractionMeta: extractionMetaRef.current,
        });
      }

      return { ...resolved, doctorResolved };
    } finally {
      setResolvingFacility(false);
    }
  };

  const handleFacilityInput = (facilityName) => {
    clearCommittedFacility();
    setExtractionMeta((prev) => ({
      ...prev,
      facilityName: "",
      facilityCreated: false,
      extractedDoctorName: "",
      doctorCreated: false,
    }));
    setFacilityProfileIncomplete(false);
    setFacilityCreated(false);
    setMissingDefaultDoctor(false);
    setDoctorCreated(false);
    setFormDataAndRef((prev) => ({
      ...prev,
      facility: "",
      facilityName,
      specificDoctor: "",
      specificDoctorId: "",
      specificDoctorIsDefault: false,
    }));
  };

  const handleFacilitySelect = (facility) => {
    const newFacilityId = String(facility.id);
    const prevFacilityId = `${formDataRef.current.facility || ""}`.trim();
    const selectedFacilityName = facility.facility || facility.facilityName || "";
    const subpoenaFacilityName = `${extractionMetaRef.current.facilityName || ""}`.trim();
    const subpoenaDoctorMismatch =
      Boolean(subpoenaFacilityName) &&
      Boolean(selectedFacilityName) &&
      !isSameFacilityLabel(subpoenaFacilityName, selectedFacilityName) &&
      Boolean(
        formDataRef.current.specificDoctor ||
          formDataRef.current.specificDoctorId ||
          extractionMetaRef.current.extractedDoctorName
      );
    const facilityChanged =
      Boolean(prevFacilityId && prevFacilityId !== newFacilityId) ||
      subpoenaDoctorMismatch;

    const next = {
      ...formDataRef.current,
      facility: newFacilityId,
      facilityName: facility.facility || facility.facilityName || "",
      ...(facilityChanged
        ? {
            specificDoctor: "",
            specificDoctorId: "",
            specificDoctorIsDefault: false,
          }
        : {}),
    };

    setFormDataAndRef(next);
    syncFacilityFromForm(next, { facilityChanged });
  };

  const handleFacilityCommit = (typedName = "") => {
    const trimmedName = `${typedName || formDataRef.current.facilityName || ""}`.trim();

    if (!trimmedName) {
      return;
    }

    const committed = committedFacilityRef.current;
    if (
      committed.id &&
      formDataRef.current.facility === committed.id &&
      isSameFacilityLabel(trimmedName, committed.name)
    ) {
      return;
    }

    syncFacilityFromForm({
      ...formDataRef.current,
      facilityName: trimmedName,
      facility: "",
    });
  };

  const handleFacilityBlur = () => {
    handleFacilityCommit();
  };

  const hasSubpoena = Boolean(
    formData.subpoenaFile || formData.subpoenaUrl || formData.subpoenaStoragePath
  );

  const visiblePanelKeys = hasSubpoena
    ? ["subpoena", "order", "serve", "payment"]
    : ["order", "serve", "payment"];

  const allExpanded = visiblePanelKeys.every((key) => expandedPanels[key]);

  const togglePanel = (panel) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  const toggleAllPanels = () => {
    const nextValue = !allExpanded;

    setExpandedPanels((prev) => ({
      ...prev,
      subpoena: hasSubpoena ? nextValue : false,
      order: nextValue,
      serve: nextValue,
      payment: nextValue,
    }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    if (PROVIDER_SYNC_FIELDS.has(name)) {
      setFormData((prev) => {
        syncProviderFromForm(prev);
        return prev;
      });
    }
  };

  const syncProviderFromForm = async (data) => {
    const providerId = Number(data.providerId);

    if (!Number.isFinite(providerId) || providerId <= 0) return;
    if (!(`${data.serveCompanyName || ""}`.trim())) return;

    try {
      await updateProvider(providerId, {
        companyName: data.serveCompanyName,
        address: data.address,
        zip: data.zip,
        city: data.city,
        state: data.state,
        phone: data.phone,
        fax: data.fax,
        email: data.email,
      });

      setApiFieldErrors((prev) => {
        const next = { ...prev };
        PROVIDER_SYNC_FIELDS.forEach((field) => {
          delete next[field];
        });
        return next;
      });
    } catch (err) {
      const { fieldErrors } = applyApiFieldErrors(err, {
        companyName: "serveCompanyName",
      });

      if (Object.keys(fieldErrors).length > 0) {
        setApiFieldErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
    }
  };

  const handleProviderBlur = () => {
    setFormData((prev) => {
      syncProviderFromForm(prev);
      return prev;
    });
  };

  const getError = (name) => {
    const shouldShowImmediately =
      immediateRequiredFields.includes(name) || isEditMode;

    if (shouldShowImmediately || touched[name] || submitAttempted) {
      return errors[name] || "";
    }

    return "";
  };

  const handlePaymentValuesChange = (updates) => {
    setFormData((prev) =>
      syncPaymentDueFields(
        {
          ...prev,
          ...updates,
        },
        prev.invoiceFees
      )
    );
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "recordTypes" && value && typeof value === "object") {
      setFormData((prev) => ({
        ...prev,
        ...value,
      }));
      return;
    }

    if (name === "certificateNoRecords") {
      setFormData((prev) => ({
        ...prev,
        certificateNoRecords: checked,
        cnrReason: checked ? prev.cnrReason : "",
        cnrDelivery: checked ? prev.cnrDelivery : "",
        cnrDateSent: checked ? prev.cnrDateSent : "",
        cnrMemo: checked ? prev.cnrMemo : false,
      }));

      return;
    }

    let nextValue = value;

    if (type === "checkbox") {
      nextValue = checked;
    } else if (phoneFields.includes(name)) {
      nextValue = formatPhone(value);
    } else if (name === "ssn") {
      nextValue = formatSSN(value);
    } else if (name === "zip") {
      nextValue = value.replace(/\D/g, "").slice(0, 5);
    } else if (name === "state") {
      nextValue = value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    } else if (numericOnlyFields.includes(name)) {
      nextValue = value.replace(/\D/g, "").slice(0, 12);
    } else if (moneyFields.includes(name)) {
      nextValue = formatMoneyInput(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "specificDoctor" && nextValue !== prev.specificDoctor
        ? { specificDoctorIsDefault: false, specificDoctorId: "" }
        : {}),
    }));

    setApiFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (name === "facility") {
      setExtractionMeta((prev) => ({ ...prev, facilityName: "", facilityCreated: false }));
    }
  };

  const handleProviderInput = (companyName) => {
    setExtractionMeta((prev) => ({ ...prev, providerName: "" }));
    setFormData((prev) => ({
      ...prev,
      providerId: "",
      serveCompanyName: companyName,
      address: "",
      zip: "",
      city: "",
      state: "",
      phone: "",
      fax: "",
      email: "",
    }));
  };

  const handleProviderSelect = (provider) => {
    setFormData((prev) => ({
      ...prev,
      providerId: String(provider.id),
      serveCompanyName: provider.companyName || "",
      address: provider.address || "",
      zip: provider.zipCode || provider.zip || "",
      city: provider.city || "",
      state: provider.state || "",
      phone: provider.phone || "",
      fax: provider.fax || "",
      email: provider.email || "",
    }));
  };

  const handleFileChange = async (e, fieldName) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file);

    setFormData((prev) => ({
      ...prev,
      [fieldName]: file,
      ...(fieldName === "subpoenaFile" && !file ? { subpoenaExtractId: "" } : {}),
    }));

    setFileErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));

    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));

    if (fieldName === "subpoenaFile" && file && !error && !isEditMode) {
      setExpandedPanels((prev) => ({
        ...prev,
        subpoena: true,
      }));

      setExtractingSubpoena(true);
      setExtractError("");

      try {
        const facilityList = facilities.length ? facilities : await getFacilities();
        const providerList = await getProviders();
        if (!facilities.length) {
          setFacilities(facilityList);
        }

        const result = await uploadSingleSubpoena(file);
        const extract = result?.extract || result;

        const { formUpdates, meta } = buildFormFromExtract(
          { ...extract, extractId: result?.extractId },
          { facilityList, providerList },
          file
        );

        await applyExtractFormUpdates(formUpdates, meta, file);
        setExpandedPanels((prev) => ({
          ...prev,
          subpoena: true,
          order: true,
        }));
      } catch (err) {
        setExtractError(
          err.message || "Failed to extract subpoena. You can still fill the form manually."
        );
      } finally {
        setExtractingSubpoena(false);
      }
    }
  };

  const handleSaveOrder = async () => {
    setSubmitAttempted(true);
    setSaveError("");
    setApiFieldErrors({});

    const resolvedFacility = await syncFacilityFromForm(formDataRef.current);

    if (resolvedFacility?.facilityProfileIncomplete) {
      setSaveError(
        "Complete the facility profile before saving this order."
      );
      return;
    }

    if (resolvedFacility?.doctorResolved?.missingDefaultDoctor) {
      setSaveError(
        "Add a default doctor for this facility before saving this order."
      );
      return;
    }

    const syncedFormData = {
      ...formDataRef.current,
      facility: resolvedFacility?.facilityId || "",
      facilityName: resolvedFacility?.facilityName || "",
      specificDoctor:
        resolvedFacility?.doctorResolved?.specificDoctor ??
        formDataRef.current.specificDoctor ??
        "",
      specificDoctorIsDefault:
        resolvedFacility?.doctorResolved?.specificDoctorIsDefault ??
        formDataRef.current.specificDoctorIsDefault ??
        false,
    };

    const currentErrors = {
      ...validateNewOrderForm(syncedFormData, fileErrors),
      ...validateOrderPaymentAmounts(syncedFormData, syncedFormData.invoiceFees),
    };

    if (Object.keys(currentErrors).length > 0) {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    setSaving(true);

    const activeOrderId = orderId || String(syncedFormData.id || "");

    try {
      if (isEditMode || activeOrderId) {
        if (resolvedFacility?.facilityId) {
          await updateOrderFacility(activeOrderId, {
            facilityId: resolvedFacility.facilityId,
            facilityName: resolvedFacility.facilityName,
          });
          markCommittedFacility(
            resolvedFacility.facilityId,
            resolvedFacility.facilityName
          );
        }

        await updateOrder(activeOrderId, syncedFormData);
        clearDraftOrderSession(draftScope);
        draftRestoredRef.current = false;
        router.push(resolveListPath(syncedFormData.creationSource));
        return;
      }

      const order = await createOrder(syncedFormData);
      if (order?.id) {
        clearDraftOrderSession(draftScope);
        draftRestoredRef.current = false;
        router.push(resolveListPath(syncedFormData.creationSource));
        return;
      }

      setSaveError("Order was saved but could not return to the orders list. Please refresh and try again.");
      setSaving(false);
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err);

      if (Object.keys(fieldErrors).length > 0) {
        setApiFieldErrors(fieldErrors);
      }

      setSaveError(message || getApiErrorMessage(err, "Failed to save order"));
      setSaving(false);
    }
  };

  if (isEditMode && loadingOrder) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] items-center justify-center">
          <p className="text-[13px] text-[#64748B]">Loading order...</p>
        </div>
      </DashboardShell>
    );
  }

  if (isEditMode && loadError) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] flex-col items-center justify-center gap-3">
          <p className="text-[13px] font-semibold text-red-500">{loadError}</p>
          <button
            type="button"
            onClick={() => router.push(resolveListPath(formData.creationSource))}
            className="rounded-[6px] bg-[#0097B2] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
          >
            {resolveListPath(formData.creationSource) === "/personal-orders"
              ? "Back to Personal Orders"
              : resolveListPath(formData.creationSource) === "/company-orders"
                ? "Back to Company Orders"
                : "Back to Orders"}
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-92px)] flex-col gap-4 overflow-hidden">
        {facilitiesLoadError && (
          <div className="shrink-0 rounded-[6px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-red-600">
            {facilitiesLoadError}
          </div>
        )}

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-[#111827]">
              {isEditMode ? "Edit Order" : "New Order"}
            </h1>

            <p className="mt-[4px] text-[13px] text-[#64748B]">
              {isEditMode
                ? `Editing existing order ${formData.orderNumber || orderId}`
                : formData.subpoenaFile
                ? "Create a new DMS order with attached subpoena"
                : "Create a new DMS order with all required information"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isEditMode && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-4 py-2 text-[12px] font-semibold text-[#EA580C]">
                Editing Order #{formData.orderNumber || orderId}
              </span>
            )}

            {(formData.subpoenaFile || formData.subpoenaUrl || formData.subpoenaStoragePath) && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#E6F7FA] px-4 py-2 text-[12px] font-semibold text-[#007F96]">
                <SubpoenaIcon />
                Subpoena attached
              </span>
            )}

            <button
              type="button"
              onClick={toggleAllPanels}
              className="w-fit rounded-full bg-[#E6F7FA] px-4 py-2 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
            >
              {allExpanded ? "↙ Collapse All" : "↗ Expand All"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:items-stretch">
          {(formData.subpoenaFile || formData.subpoenaUrl || formData.subpoenaStoragePath) && (
            <CollapsibleOrderPanel
              title="Subpoena"
              color="subpoena"
              icon={<SubpoenaIcon />}
              expanded={expandedPanels.subpoena}
              onToggle={() => togglePanel("subpoena")}
            >
              <SubpoenaPreviewContent
                file={formData.subpoenaFile}
                src={
                  formData.subpoenaFile
                    ? undefined
                    : editSubpoenaSrc || toFileUrl(formData.subpoenaUrl)
                }
                name={subpoenaFileName(formData.subpoenaStoragePath)}
              />
            </CollapsibleOrderPanel>
          )}

          <CollapsibleOrderPanel
            title="Order Details"
            color="order"
            icon={<OrderIcon />}
            expanded={expandedPanels.order}
            onToggle={() => togglePanel("order")}
          >
            <OrderDetailsForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
              onFileChange={handleFileChange}
              submitAttempted={submitAttempted}
              extractingSubpoena={extractingSubpoena}
              extractError={extractError}
              extractionMeta={extractionMeta}
              facilityProfileIncomplete={facilityProfileIncomplete}
              facilityCreated={facilityCreated}
              resolvingFacility={resolvingFacility}
              onFacilityInput={handleFacilityInput}
              onFacilitySelect={handleFacilitySelect}
              onFacilityBlur={handleFacilityBlur}
              onFacilityCommit={handleFacilityCommit}
              returnToOrderPath={returnToOrderPath}
              onBeforeFacilityProfileNavigate={persistOrderDraft}
            />
          </CollapsibleOrderPanel>

          <CollapsibleOrderPanel
            title="Serve Info"
            color="serve"
            icon={<ServeIcon />}
            expanded={expandedPanels.serve}
            onToggle={() => togglePanel("serve")}
          >
            <ServeInfoForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
              onProviderInput={handleProviderInput}
              onProviderSelect={handleProviderSelect}
              onProviderBlur={handleProviderBlur}
              extractionMeta={extractionMeta}
              missingDefaultDoctor={missingDefaultDoctor}
              doctorCreated={doctorCreated}
              resolvingDoctor={resolvingDoctor}
              returnToOrderPath={returnToOrderPath}
              onBeforeFacilityProfileNavigate={persistOrderDraft}
            />
          </CollapsibleOrderPanel>

          <CollapsibleOrderPanel
            title="Payment"
            color="payment"
            icon={<PaymentIcon />}
            expanded={expandedPanels.payment}
            onToggle={() => togglePanel("payment")}
          >
            <PaymentForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
              onValuesChange={handlePaymentValuesChange}
            />
          </CollapsibleOrderPanel>
        </div>

        <OrderSaveActionBar
          onSave={handleSaveOrder}
          disabled={
            (isEditMode ? hasValidationErrors : hasImmediateRequiredErrors) ||
            saving ||
            facilityProfileIncomplete ||
            missingDefaultDoctor ||
            resolvingFacility ||
            resolvingDoctor
          }
          label={
            saving
              ? "Saving..."
              : isEditMode
              ? "Update Order"
              : "Save Order"
          }
          saveError={saveError}
        />
      </div>

      <SubpoenaExtractionOverlay open={extractingSubpoena} />
    </DashboardShell>
  );
}

function OrderDetailsForm({
  formData,
  onChange,
  onBlur,
  getError,
  onFileChange,
  submitAttempted,
  extractingSubpoena = false,
  extractError = "",
  extractionMeta = {},
  facilityProfileIncomplete = false,
  facilityCreated = false,
  resolvingFacility = false,
  onFacilityInput,
  onFacilitySelect,
  onFacilityBlur,
  onFacilityCommit,
  returnToOrderPath = "",
  onBeforeFacilityProfileNavigate,
}) {
  const hasRequiredErrors =
    getError("facility") ||
    getError("type") ||
    getError("firstName") ||
    getError("lastName");

  const facilityHint =
    extractionMeta.facilityName &&
    formData.facility &&
    !facilityProfileIncomplete &&
    !facilityCreated
      ? `Matched from subpoena: ${extractionMeta.facilityName}`
      : "";

  return (
    <div className="space-y-5">
      <div className="rounded-[6px] bg-[#F8FAFC] px-3 py-2 text-[11px] font-medium text-[#64748B]">
        <span className="mr-2 text-red-500">*</span>
        <span>* Required field</span>
      </div>

      <div className="space-y-4">
        <FacilitySearchField
          label="Facility"
          value={formData.facilityName || ""}
          facilityId={formData.facility || ""}
          onInputChange={onFacilityInput}
          onSelect={onFacilitySelect}
          onBlur={onFacilityBlur}
          onCommit={onFacilityCommit}
          resolving={resolvingFacility}
          facilityProfileIncomplete={facilityProfileIncomplete}
          facilityCreated={facilityCreated}
          returnToOrderPath={returnToOrderPath}
          onBeforeFacilityProfileNavigate={onBeforeFacilityProfileNavigate}
          hint={facilityHint}
          required
          error={
            getError("facility") ||
            (facilityProfileIncomplete
              ? "Complete the facility profile to continue"
              : "")
          }
        />

        <RecordTypeMultiSelect
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          required
          error={getError("type")}
        />

        <NewOrderField
          label="Case #"
          name="caseNumber"
          value={formData.caseNumber}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter case number"
        />

        <NewOrderField
          label="SSN"
          name="ssn"
          value={formData.ssn}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="XXX-XX-1234"
          inputMode="numeric"
          maxLength={11}
          hint="SSN required if you have one"
          error={getError("ssn")}
        />

        <NewOrderField
          label="DOB"
          name="dob"
          value={formData.dob}
          onChange={onChange}
          onBlur={onBlur}
          type="date"
          error={getError("dob")}
        />
      </div>

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">Applicant</h3>
        <p className="mt-[2px] text-[11px] italic text-[#64748B]">
          Completion of this section is required
        </p>

        <div className="mt-4 space-y-4">
          <NewOrderField
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="First name"
            required
            error={getError("firstName")}
          />

          <NewOrderField
            label="Middle Name"
            name="middleName"
            value={formData.middleName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Middle name"
          />

          <NewOrderField
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Last name"
            required
            error={getError("lastName")}
          />

          <NewOrderField
            label="AKA"
            name="aka"
            value={formData.aka}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Also known as"
          />

          <NewOrderField
            label="Defendant"
            name="defendant"
            value={formData.defendant}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Defendant name"
          />
        </div>
      </div>

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">
          Date of Injury (Complete all relevant information):
        </h3>

        <div className="mt-3 space-y-3">
          <div>
            <label className="flex flex-wrap items-center gap-2 text-[12px] text-[#475569]">
              <input
                type="radio"
                name="injuryType"
                value="specific"
                checked={formData.injuryType === "specific"}
                onChange={onChange}
                className="h-[13px] w-[13px] border-[#CBD5E1] accent-[#0097B2]"
              />
              <span>specific injury on this date:</span>
              <input
                type="date"
                name="injuryDate"
                value={formData.injuryDate}
                onChange={onChange}
                onBlur={onBlur}
                disabled={formData.injuryType !== "specific"}
                className={`h-[34px] rounded-[6px] border bg-white px-2 text-[12px] text-[#111827] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] ${
                  getError("injuryDate")
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                }`}
              />
            </label>
            {getError("injuryDate") ? (
              <p className="mt-1 text-[11px] font-medium text-red-500">
                {getError("injuryDate")}
              </p>
            ) : null}
          </div>

          <div>
            <label className="flex flex-wrap items-center gap-2 text-[12px] text-[#475569]">
              <input
                type="radio"
                name="injuryType"
                value="cumulative"
                checked={formData.injuryType === "cumulative"}
                onChange={onChange}
                className="h-[13px] w-[13px] border-[#CBD5E1] accent-[#0097B2]"
              />
              <span>cumulative injury which began on</span>
              <input
                type="date"
                name="injuryDateBegin"
                value={formData.injuryDateBegin}
                onChange={onChange}
                onBlur={onBlur}
                disabled={formData.injuryType !== "cumulative"}
                className={`h-[34px] rounded-[6px] border bg-white px-2 text-[12px] text-[#111827] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] ${
                  getError("injuryDateBegin")
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                }`}
              />
              <span>through</span>
              <input
                type="date"
                name="injuryDateEnd"
                value={formData.injuryDateEnd}
                onChange={onChange}
                onBlur={onBlur}
                disabled={formData.injuryType !== "cumulative"}
                className={`h-[34px] rounded-[6px] border bg-white px-2 text-[12px] text-[#111827] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] ${
                  getError("injuryDateEnd")
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                }`}
              />
            </label>
            {getError("injuryDateBegin") || getError("injuryDateEnd") ? (
              <p className="mt-1 text-[11px] font-medium text-red-500">
                {getError("injuryDateEnd") || getError("injuryDateBegin")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Divider />

      <FileInput
        title="Upload Subpoena"
        onChange={(e) => onFileChange(e, "subpoenaFile")}
        error={getError("subpoenaFile")}
      />

      {extractError && (
        <p className="text-[12px] font-medium text-amber-600">{extractError}</p>
      )}

      {formData.subpoenaExtractId && !extractingSubpoena && (
        <p className="text-[12px] font-medium text-[#059669]">
          Subpoena saved and form prefilled from extracted data.
        </p>
      )}

      {!formData.subpoenaFile && formData.subpoenaUrl && (
        <ExistingFileLink
          label="Current subpoena"
          name={subpoenaFileName(formData.subpoenaStoragePath)}
          href={toFileUrl(formData.subpoenaUrl)}
        />
      )}

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">
          Upload Additional Document
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <NewOrderField
            name="documentName"
            value={formData.documentName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Document Name"
            error={getError("documentName")}
          />

          <FileInput
            compact
            onChange={(e) => onFileChange(e, "additionalDocumentFile")}
            error={getError("additionalDocumentFile")}
          />
        </div>

        {Array.isArray(formData.documents) && formData.documents.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Uploaded documents
            </p>

            {formData.documents.map((doc) => (
              <ExistingFileLink
                key={doc.id}
                label={doc.documentName || "Document"}
                name={doc.originalFileName}
                href={toFileUrl(doc.url)}
              />
            ))}
          </div>
        )}
      </div>

      {(submitAttempted || hasRequiredErrors) && hasRequiredErrors && (
        <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
          ⓘ Please fill out all required fields
        </div>
      )}

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">Notes</h3>

        <p className="mt-3 text-[12px] font-semibold text-[#64748B]">
          Date By Callback Note
        </p>

        <div className="mt-2 rounded-[8px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center text-[12px] text-[#94A3B8]">
          No notes logged yet. Notes will appear here after callbacks are
          recorded.
        </div>
      </div>
    </div>
  );
}

function ServeInfoForm({
  formData,
  onChange,
  onBlur,
  getError,
  onProviderInput,
  onProviderSelect,
  onProviderBlur,
  extractionMeta = {},
  missingDefaultDoctor = false,
  doctorCreated = false,
  resolvingDoctor = false,
  returnToOrderPath = "",
  onBeforeFacilityProfileNavigate,
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-[14px] font-semibold text-[#111827]">
        Serve Information
      </h3>

      <NewOrderField
        label="Order #"
        name="orderNumber"
        value={formData.orderNumber}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Order number"
        required
        error={getError("orderNumber")}
        maxLength={50}
      />

      <NewOrderField
        label="REC Number"
        name="recNumber"
        value={formData.recNumber}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Enter REC number"
      />

      <Divider />

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#111827]">Company</h3>

        <button
          type="button"
          className="text-[11px] font-semibold text-[#0097B2]"
        >
          clear
        </button>
      </div>

      <ProviderSearchField
        label="Provider"
        value={formData.serveCompanyName}
        providerId={formData.providerId}
        onInputChange={onProviderInput}
        onSelect={onProviderSelect}
        onBlur={onProviderBlur}
        required
        error={getError("serveCompanyName")}
        hint="Search existing providers or type a new company name"
      />
      {extractionMeta.providerName && formData.providerId && (
        <p className="-mt-3 text-[10px] font-medium text-[#059669]">
          {extractionMeta.providerCreated
            ? `New provider added: ${extractionMeta.providerName}`
            : `Matched existing provider: ${extractionMeta.providerName}`}
        </p>
      )}

      <NewOrderField
        label="Address"
        name="address"
        value={formData.address}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Street address"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NewOrderField
          label="ZIP"
          name="zip"
          value={formData.zip}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="ZIP"
          inputMode="numeric"
          maxLength={5}
          error={getError("zip")}
        />

        <NewOrderField
          label="City"
          name="city"
          value={formData.city}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="City"
        />

        <NewOrderField
          label="State"
          name="state"
          value={formData.state}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="State"
          maxLength={2}
          error={getError("state")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NewOrderField
          label="Phone"
          name="phone"
          value={formData.phone}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError("phone")}
        />

        <NewOrderField
          label="Fax"
          name="fax"
          value={formData.fax}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError("fax")}
        />
      </div>

      <NewOrderField
        label="Provider email"
        name="email"
        value={formData.email}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="company@email.com"
        required
        error={getError("email")}
      />

      <Divider />

      <h3 className="text-[13px] font-semibold text-[#111827]">Contact</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ContactCard
          number="1"
          prefix="contact1"
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />

        <ContactCard
          number="2"
          prefix="contact2"
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />
      </div>

      <Divider />

      <h3 className="text-[13px] font-semibold text-[#111827]">
        Dates and Records
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <NewOrderField
            label="Date Served"
            name="dateServed"
            value={formData.dateServed}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Depo Due Date"
            name="depoDueDate"
            value={formData.depoDueDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Delivery Date"
            name="deliveryDate"
            value={formData.deliveryDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Date of Subpoena"
            name="subpoenaDate"
            value={formData.subpoenaDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Ready Date"
            name="readyDate"
            value={formData.readyDate}
            type="date"
            disabled
            placeholder="-"
          />
          <NewOrderField
            label="Invoice Date"
            name="invoiceDate"
            value={formData.invoiceDate}
            type="date"
            disabled
            placeholder="-"
          />
          <NewOrderField
            label="Xray Invoice Date"
            name="xrayInvoiceDate"
            value={formData.xrayInvoiceDate}
            type="date"
            disabled
            placeholder="-"
          />
        </div>
      </div>

      <Divider />

      <NewOrderField
        label="Date Requested"
        name="dateRequested"
        value={formData.dateRequested}
        onChange={onChange}
        onBlur={onBlur}
        type="date"
      />

      <NewOrderField
        label="Specific Record"
        name="specificRecord"
        value={formData.specificRecord}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Specific record details"
      />

      <DoctorSearchField
        label="Specific Doctor"
        name="specificDoctor"
        value={formData.specificDoctor}
        facilityId={formData.facility}
        facilityName={formData.facilityName}
        specificDoctorIsDefault={formData.specificDoctorIsDefault}
        extractedDoctorName={extractionMeta.extractedDoctorName}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Doctor name"
        error={
          getError("specificDoctor") ||
          (missingDefaultDoctor ? "Add a default doctor to continue" : "")
        }
        missingDefaultDoctor={missingDefaultDoctor}
        doctorCreated={doctorCreated}
        resolvingDoctor={resolvingDoctor}
        returnToOrderPath={returnToOrderPath}
        onBeforeFacilityProfileNavigate={onBeforeFacilityProfileNavigate}
      />

      <DoctorAddressSearchField
        label="Full Address"
        name="fullAddress"
        value={formData.fullAddress}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Full address"
        error={getError("fullAddress")}
      />

      <Divider />

      <CheckboxOption
        label="Certificate of No Records"
        name="certificateNoRecords"
        checked={formData.certificateNoRecords}
        onChange={onChange}
      />

      {formData.certificateNoRecords && (
        <CertificateNoRecordsPanel
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />
      )}
    </div>
  );
}

function OrderSaveActionBar({ onSave, disabled, label, saveError = "" }) {
  return (
    <section className="shrink-0 rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[720px] text-[11px] leading-[16px] text-[#64748B]">
          This button becomes clickable after you complete all mandatory fields
          in the cards above.
        </p>

        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className={`flex h-[44px] min-w-[220px] shrink-0 items-center justify-center gap-2 rounded-[8px] px-6 text-[13px] font-semibold transition ${
            disabled
              ? "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
              : "bg-[#0097B2] text-white shadow-sm hover:bg-[#0086A0]"
          }`}
        >
          <SaveIcon />
          {label}
        </button>
      </div>

      {saveError && (
        <div className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">
          {saveError}
        </div>
      )}
    </section>
  );
}

import {
  getPaymentChargeForType,
  dueAmountFromFee,
  parsePaymentAmount,
} from "@/lib/orders/paymentUtils";

function PaymentForm({
  formData,
  onChange,
  onBlur,
  getError,
  onValuesChange,
}) {
  const invoiceFees = formData.invoiceFees;
  const prepaymentCharge = getPaymentChargeForType("prepayment", invoiceFees);
  const isPersonalPortalOrder = formData.creationSource === "personal_portal";

  return (
    <div className="space-y-5">
      <h3 className="text-[14px] font-semibold text-[#111827]">
        Payment Details
      </h3>

      <PaymentChargeCard
        title="Prepayment Fee"
        chargeAmount={prepaymentCharge}
        paidAmount={formData.prepaymentPaid}
        showPaidField
        autoDueOnPaidChange
        theme="green"
        prefix="prepayment"
        formData={formData}
        onChange={onChange}
        onBlur={onBlur}
        getError={getError}
        onValuesChange={onValuesChange}
        checkLabel={isPersonalPortalOrder ? "Receipt Number" : "Check #"}
        checkPlaceholder={
          isPersonalPortalOrder ? "Receipt number" : "Check number"
        }
        checkDisplayValue={
          isPersonalPortalOrder ? formData.prepaymentCheck || "" : null
        }
        checkReadOnly={isPersonalPortalOrder}
      />

      <PaymentChargeCard
        title="Xray Charge"
        paidAmount={formData.xrayPaid}
        showPaidField
        paidReadOnly={false}
        fieldsReadOnly={false}
        autoDueOnPaidChange
        capPaidToDue
        paymentType="xray"
        invoiceFees={invoiceFees}
        theme="blue"
        prefix="xray"
        formData={formData}
        onChange={onChange}
        onBlur={onBlur}
        getError={getError}
        onValuesChange={onValuesChange}
      />
    </div>
  );
}

function ContactCard({ number, prefix, formData, onChange, onBlur, getError }) {
  return (
    <div className="rounded-[8px] bg-[#F8FAFC] p-3">
      <h4 className="mb-3 text-[12px] font-semibold text-[#64748B]">
        Contact {number}
      </h4>

      <div className="space-y-3">
        <NewOrderField
          label="Name"
          name={`${prefix}Name`}
          value={formData[`${prefix}Name`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Contact name"
        />

        <NewOrderField
          label="Title"
          name={`${prefix}Title`}
          value={formData[`${prefix}Title`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Title"
        />

        <NewOrderField
          label="Phone"
          name={`${prefix}Phone`}
          value={formData[`${prefix}Phone`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError(`${prefix}Phone`)}
        />

        <NewOrderField
          label="Fax"
          name={`${prefix}Fax`}
          value={formData[`${prefix}Fax`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError(`${prefix}Fax`)}
        />

        <NewOrderField
          label="Email"
          name={`${prefix}Email`}
          value={formData[`${prefix}Email`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="email@example.com"
          error={getError(`${prefix}Email`)}
        />
      </div>
    </div>
  );
}

function FileInput({ title, onChange, error, compact = false }) {
  return (
    <div>
      {title && (
        <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">
          {title}
        </h3>
      )}

      <input
        type="file"
        onChange={onChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className={`block w-full text-[12px] text-[#64748B] file:mr-3 file:rounded-[6px] file:border file:border-[#E2E8F0] file:bg-white file:px-3 file:py-2 file:text-[12px] file:font-medium file:text-[#334155] ${
          compact ? "max-w-full" : ""
        }`}
      />

      {error && (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

function ExistingFileLink({ label, name, href }) {
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 hover:border-[#0097B2] hover:bg-[#F0FBFD]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold text-[#111827]">
          {label}
        </span>
        {name && (
          <span className="block truncate text-[11px] text-[#64748B]">
            {name}
          </span>
        )}
      </span>

      <span className="shrink-0 text-[11px] font-semibold text-[#0097B2]">
        View
      </span>
    </a>
  );
}

function Divider() {
  return <div className="h-px w-full bg-[#E2E8F0]" />;
}