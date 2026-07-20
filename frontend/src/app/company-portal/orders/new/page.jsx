"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpoenaExtractionOverlay from "@/components/orders/new-order/SubpoenaExtractionOverlay";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyOrderStepper from "@/components/company-portal/CompanyOrderStepper";
import CompanyOrderUploadStep from "@/components/company-portal/CompanyOrderUploadStep";
import CompanyOrderVerifyStep from "@/components/company-portal/CompanyOrderVerifyStep";
import CompanyOrderPaymentStep from "@/components/company-portal/CompanyOrderPaymentStep";
import CompanyEmployeeInsufficientWalletModal from "@/components/company-portal/CompanyEmployeeInsufficientWalletModal";
import {
  clearCompanyOrderWizardState,
  createCompanyPortalCheckout,
  loadCompanyOrderWizardState,
  saveCompanyOrderWizardState,
  uploadCompanyPortalSubpoena,
  validateCompanyPortalOrderNumber,
  COMPANY_PORTAL_ORDER_FEE,
} from "@/lib/company-portal/companyPortalOrderApi";
import {
  createEmptyCompanyOrderForm,
  validateCompanyOrderForm,
  calculateCompanyPortalOrderTotal,
  COMPANY_PORTAL_BASE_ORDER_FEE,
} from "@/lib/company-portal/companyPortalOrderUtils";
import {
  getStoredCompanyUser,
  isCompanyAuthenticated,
} from "@/lib/company-portal/companyPortalAuthStorage";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import { getCompanyWalletSummary } from "@/lib/company-portal/companyPortalManagementApi";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
} from "@/lib/apiErrorUtils";

function CompanyOrderCreateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [uploadToken, setUploadToken] = useState("");
  const [form, setForm] = useState(createEmptyCompanyOrderForm());
  const [errors, setErrors] = useState({});
  const [fileMeta, setFileMeta] = useState(null);
  const [localFile, setLocalFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [validatingOrderNumber, setValidatingOrderNumber] = useState(false);
  const [error, setError] = useState("");
  const [canceled, setCanceled] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [showEmployeeWalletModal, setShowEmployeeWalletModal] = useState(false);
  const storedUser = getStoredCompanyUser();
  const isEmployee = storedUser?.isAdmin === false;
  const availableWalletBalance = Number(walletBalance ?? 0);
  const orderTotal = calculateCompanyPortalOrderTotal(form);
  const hasEnoughWalletBalance =
    availableWalletBalance >= COMPANY_PORTAL_BASE_ORDER_FEE;
  const hasEnoughForOrderTotal = availableWalletBalance >= orderTotal;

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
    }
  }, [router]);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const wasCanceled = searchParams.get("canceled") === "1";
    if (wasCanceled) setCanceled(true);

    const saved = loadCompanyOrderWizardState();
    if (saved?.uploadToken) {
      setUploadToken(saved.uploadToken);
      if (saved.form) setForm({ ...createEmptyCompanyOrderForm(), ...saved.form });
      if (saved.fileMeta) setFileMeta(saved.fileMeta);
      if (stepParam === "payment" || wasCanceled) setStep(3);
      else if (stepParam === "verify" || saved.form) setStep(2);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    let active = true;
    setWalletLoading(true);

    const loadBalance = isEmployee
      ? getCompanyCurrentUser().then((response) =>
          Number(response?.data?.user?.walletBalance || 0)
        )
      : getCompanyWalletSummary().then((response) =>
          Number(response?.data?.unallocatedBalance || 0)
        );

    loadBalance
      .then((balance) => {
        if (!active) return;
        setWalletBalance(balance);
      })
      .catch(() => {
        if (!active) return;
        setWalletBalance(0);
      })
      .finally(() => {
        if (active) setWalletLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isEmployee]);

  useEffect(() => {
    if (!walletLoading && isEmployee && !hasEnoughWalletBalance) {
      setShowEmployeeWalletModal(true);
    }
  }, [walletLoading, isEmployee, hasEnoughWalletBalance]);

  const persistWizard = (next = {}) => {
    saveCompanyOrderWizardState({
      uploadToken: next.uploadToken ?? uploadToken,
      form: next.form ?? form,
      fileMeta: next.fileMeta ?? fileMeta,
      step: next.step ?? step,
    });
  };

  const handleFileSelected = (file) => {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !String(file.name || "").toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are allowed");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("PDF must be 50MB or smaller");
      return;
    }

    setError("");
    setLocalFile(file);
    setFileMeta({ name: file.name, size: file.size });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setLocalFile(null);
    setFileMeta(null);
    setUploadToken("");
    clearCompanyOrderWizardState();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setError("");
  };

  const handleProcess = async () => {
    if (!localFile || extracting) return;

    if (!hasEnoughWalletBalance) {
      if (isEmployee) {
        setShowEmployeeWalletModal(true);
        setError("");
      } else {
        setError(
          `Wallet balance is below $${COMPANY_PORTAL_ORDER_FEE.toFixed(
            2
          )}. Please top up before creating an order.`
        );
      }
      return;
    }

    setExtracting(true);
    setError("");

    try {
      const response = await uploadCompanyPortalSubpoena(localFile);
      const data = response?.data || {};
      if (!data.uploadToken) {
        throw new Error("Upload succeeded but no session token was returned");
      }

      const nextForm = {
        ...createEmptyCompanyOrderForm(),
        ...(data.form || {}),
      };
      const nextMeta = data.fileMeta || {
        name: localFile.name,
        size: localFile.size,
      };

      setUploadToken(data.uploadToken);
      setForm(nextForm);
      setFileMeta(nextMeta);
      setStep(2);
      persistWizard({
        uploadToken: data.uploadToken,
        form: nextForm,
        fileMeta: nextMeta,
        step: 2,
      });
      router.replace("/company-portal/orders/new?step=verify");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to process subpoena"));
    } finally {
      setExtracting(false);
    }
  };

  const handleFormChange = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      persistWizard({ form: next });
      return next;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (name === "caseNumber") {
      setError("");
    }
  };

  const handleRecordTypesChange = (event) => {
    const { name, value } = event.target;
    if (name === "recordTypes" && value && typeof value === "object") {
      setForm((prev) => {
        const next = { ...prev, ...value };
        persistWizard({ form: next });
        return next;
      });
      setErrors((prev) => {
        if (!prev.type) return prev;
        const next = { ...prev };
        delete next.type;
        return next;
      });
    }
  };

  const clearFacilityFieldErrors = () => {
    setErrors((prev) => {
      const next = { ...prev };
      [
        "facilitySelectionMode",
        "internalFacilityId",
        "facilityName",
        "facilityAddress",
        "facilityCity",
        "facilityState",
        "facilityZip",
      ].forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const handleFacilityInputChange = (value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        facilityName: value,
        facilitySelectionMode: "",
        internalFacilityId: null,
        requestNewFacilitySearch: false,
        facilityAddress: "",
        facilityCity: "",
        facilityState: "",
        facilityZip: "",
      };
      persistWizard({ form: next });
      return next;
    });
    clearFacilityFieldErrors();
  };

  const handleFacilitySelect = (facility) => {
    setForm((prev) => {
      const next = {
        ...prev,
        facilitySelectionMode: "existing",
        internalFacilityId: facility.id,
        requestNewFacilitySearch: false,
        facilityName: facility.facilityName || "",
        facilityAddress: facility.streetAddress || "",
        facilityCity: facility.city || "",
        facilityState: facility.state || "",
        facilityZip: facility.zip || "",
      };
      persistWizard({ form: next });
      return next;
    });
    clearFacilityFieldErrors();
  };

  const handleAddNewFacility = (values) => {
    setForm((prev) => {
      const next = {
        ...prev,
        facilitySelectionMode: "new",
        internalFacilityId: null,
        requestNewFacilitySearch: true,
        facilityName: values.facilityName || "",
        facilityAddress: values.facilityAddress || "",
        facilityCity: values.facilityCity || "",
        facilityState: values.facilityState || "",
        facilityZip: values.facilityZip || "",
        treatingDoctor: values.treatingDoctor || prev.treatingDoctor || "",
      };
      persistWizard({ form: next });
      return next;
    });
    clearFacilityFieldErrors();
  };

  const handleClearFacilitySelection = () => {
    setForm((prev) => {
      const next = {
        ...prev,
        facilitySelectionMode: "",
        internalFacilityId: null,
        requestNewFacilitySearch: false,
        facilityName: "",
        facilityAddress: "",
        facilityCity: "",
        facilityState: "",
        facilityZip: "",
      };
      persistWizard({ form: next });
      return next;
    });
    clearFacilityFieldErrors();
  };

  const handleContinueToPayment = async () => {
    const nextErrors = validateCompanyOrderForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !uploadToken) {
      if (!uploadToken) {
        setError("Please upload and process a subpoena first.");
        setStep(1);
      }
      return;
    }

    if (!hasEnoughForOrderTotal) {
      if (isEmployee) {
        setShowEmployeeWalletModal(true);
      } else {
        setError(
          `Wallet balance is below $${orderTotal.toFixed(
            2
          )}. Please top up before continuing.`
        );
      }
      return;
    }

    setValidatingOrderNumber(true);
    setError("");

    try {
      await validateCompanyPortalOrderNumber(form.caseNumber);
      setStep(3);
      persistWizard({ step: 3 });
      router.replace("/company-portal/orders/new?step=payment");
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      setError(
        message ||
          getApiErrorMessage(
            err,
            "Unable to verify order number. Please enter a unique order ID."
          )
      );
    } finally {
      setValidatingOrderNumber(false);
    }
  };

  const handlePay = async () => {
    if (!uploadToken || paying) return;

    const nextErrors = validateCompanyOrderForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(2);
      return;
    }

    if (!hasEnoughForOrderTotal) {
      if (isEmployee) {
        setShowEmployeeWalletModal(true);
      } else {
        setError(
          `Wallet balance is below $${orderTotal.toFixed(
            2
          )}. Please top up before paying.`
        );
      }
      return;
    }

    setPaying(true);
    setError("");
    persistWizard({ step: 3 });

    try {
      const response = await createCompanyPortalCheckout({
        uploadToken,
        ...form,
      });
      const payload = response?.data || {};

      if (payload.paymentMethod === "wallet" && payload.order?.orderNumber) {
        clearCompanyOrderWizardState();
        router.push(
          `/company-portal/orders/complete?order_number=${encodeURIComponent(payload.order.orderNumber)}`
        );
        return;
      }

      const checkoutUrl = payload.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Unable to start checkout");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setStep(2);
      }
      setError(message || getApiErrorMessage(err, "Unable to start payment"));
      setPaying(false);
    }
  };

  return (
    <CompanyPortalDashboardShell title="Create Order">
      <SubpoenaExtractionOverlay open={extracting} />
      <CompanyEmployeeInsufficientWalletModal
        open={showEmployeeWalletModal}
        balance={availableWalletBalance}
        requiredAmount={orderTotal}
        onClose={() => setShowEmployeeWalletModal(false)}
      />

      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <CompanyOrderStepper currentStep={step} />

          {step === 1 ? (
            <>
              {!walletLoading && !hasEnoughWalletBalance ? (
                <div className="mb-5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[13px] font-semibold text-amber-800">
                    Wallet balance is too low
                  </p>
                  <p className="mt-1 text-[12px] text-amber-700">
                    You need at least ${COMPANY_PORTAL_ORDER_FEE.toFixed(2)} to
                    upload and process a subpoena. Current balance: $
                    {availableWalletBalance.toFixed(2)}.
                  </p>
                  {isEmployee ? (
                    <button
                      type="button"
                      onClick={() => setShowEmployeeWalletModal(true)}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
                    >
                      Why can&apos;t I create an order?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push("/company-portal/money")}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
                    >
                      Top up wallet
                    </button>
                  )}
                </div>
              ) : null}

              <CompanyOrderUploadStep
                fileMeta={fileMeta}
                previewUrl={previewUrl}
                extracting={extracting}
                error={error}
                onFileSelected={handleFileSelected}
                onRemoveFile={handleRemoveFile}
                onProcess={handleProcess}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              {error ? (
                <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
                  {error}
                </p>
              ) : null}

              <CompanyOrderVerifyStep
                form={form}
                errors={errors}
                onChange={handleFormChange}
                onRecordTypesChange={handleRecordTypesChange}
                onFacilityInputChange={handleFacilityInputChange}
                onFacilitySelect={handleFacilitySelect}
                onAddNewFacility={handleAddNewFacility}
                onClearNewFacility={handleClearFacilitySelection}
                onBack={() => setStep(1)}
                onContinue={handleContinueToPayment}
                saving={validatingOrderNumber}
              />
            </>
          ) : null}

          {step === 3 ? (
            <CompanyOrderPaymentStep
              form={form}
              fileName={fileMeta?.name}
              amount={orderTotal}
              isEmployee={isEmployee}
              walletBalance={availableWalletBalance}
              onBack={() => setStep(2)}
              onPay={handlePay}
              paying={paying}
              error={error}
              canceled={canceled}
            />
          ) : null}
        </section>
      </div>
    </CompanyPortalDashboardShell>
  );
}

export default function CompanyOrderCreatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
          Loading order form...
        </main>
      }
    >
      <CompanyOrderCreateClient />
    </Suspense>
  );
}
