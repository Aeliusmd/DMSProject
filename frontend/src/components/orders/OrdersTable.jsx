"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import CreateXrayInvoiceModal from "@/components/orders/CreateXrayInvoiceModal";
import CoverSheetModal from "@/components/orders/CoverSheetModal";
import XrayCoverSheetModal from "@/components/orders/XrayCoverSheetModal";
import CertificateNoRecordsModal from "@/components/orders/CertificateNoRecordsModal";
import CertificateOfRecordsModal from "@/components/orders/CertificateOfRecordsModal";
import SendCopyLetterModal from "@/components/orders/SendCopyLetterModal";
import OrderActivityLogModal from "@/components/orders/OrderActivityLogModal";
import OrderNotesModal from "@/components/orders/OrderNotesModal";
import OrderMailModal from "@/components/orders/OrderMailModal";
import OrderPickupModal from "@/components/orders/OrderPickupModal";
import OrderFaxModal from "@/components/orders/OrderFaxModal";
import OrderCancelModal from "@/components/orders/OrderCancelModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import CompletedDeliveryLink from "@/components/orders/CompletedDeliveryLink";
import {
  cancelOrder,
  deleteOrder,
  getOrders,
  fetchOrderMedicalRecordsPdf,
  fetchOrderPrintInvoicePdf,
  fetchOrderPrintXrayInvoicePdf,
  fetchOrderSubpoenaPdf,
  mailCompletedOrder,
  sendCopyServiceLetter,
  recordOrderPickup,
  recordOrderFax,
  removeMedicalRecords,
} from "@/lib/orders/orderApi";
import { getTodayInputDate } from "@/lib/utils/dateUtils";
import {
  getCompletedDeliveryActions,
  getDeliveryStatus,
  resolveProviderEmail,
} from "@/lib/orders/deliveryActions";
import { emailInvoiceByOrderId, emailXrayInvoiceByOrderId, resendInvoices } from "@/lib/invoices/invoiceApi";
import {
  formatMoneyAmount,
  parsePaymentAmount,
} from "@/lib/orders/paymentUtils";
import SubpoenaPreviewContent from "@/components/orders/new-order/SubpoenaPreviewContent";

const ORDERS_PER_PAGE = 6;

const NO_PROVIDER_EMAIL_MESSAGE =
  "No provider email on file. Please edit the order to add the provider email.";

const defaultOrderFilters = {
  facility: "",
  year: "",
  status: "",
  search: "",
};

const DEFAULT_ORDER_FORMS = [
  "Send Copy/Letter",
  "Copy Center",
  "Certification of Records",
  "CNR",
];

const WORKFLOW_STAGES = [
  "Upload Records",
  "Review Records",
  "Serve",
  "Custodian",
  "SENT",
];

const WORKFLOW_STATUS_STYLES = {
  complete: { text: "text-[#059669]", dot: "bg-[#10B981]" },
  failed: { text: "text-red-500", dot: "bg-red-500" },
  pending: { text: "text-[#CA8A04]", dot: "bg-[#EAB308]" },
  sent: { text: "text-[#2563EB]", dot: "bg-[#3B82F6]" },
};

function isWorkflowStageComplete(status) {
  return status === "complete" || status === "sent";
}

function mapWorkflowStages(stages = []) {
  const byName = new Map(
    stages.map((stage) => [stage.stageName, stage.stageStatus])
  );

  return WORKFLOW_STAGES.map((stageName) => {
    const status = byName.get(stageName) || "pending";

    return {
      key: stageName,
      label: stageName,
      status,
    };
  });
}

function buildWorkflowStagesForOrder(order) {
  const prepaymentPaid = parsePaymentAmount(order.invoice?.prepaymentPaid);
  const custodianPaid = parsePaymentAmount(order.invoice?.custodianPaid);
  const hasMedicalRecords = Boolean(order.records?.hasMedicalRecords);

  return mapWorkflowStages(order.workflowStages).map((stage) => {
    if (stage.key === "Upload Records") {
      const isComplete =
        isWorkflowStageComplete(stage.status) || hasMedicalRecords;

      return {
        ...stage,
        status: isComplete ? "complete" : stage.status,
        label: isComplete ? "Uploaded Records" : "Scan Records",
        actionLink: !isComplete,
        showRemoveRecords: isComplete && hasMedicalRecords,
      };
    }

    if (stage.key === "Review Records") {
      const isComplete =
        isWorkflowStageComplete(stage.status) || hasMedicalRecords;

      return {
        ...stage,
        status: isComplete ? "complete" : stage.status,
      };
    }

    if (stage.key === "Serve") {
      const isComplete = isWorkflowStageComplete(stage.status);

      return {
        ...stage,
        label: isComplete ? "Serve" : "Serve Payment",
        paidAmount:
          isComplete && prepaymentPaid > 0
            ? formatMoneyAmount(prepaymentPaid)
            : null,
      };
    }

    if (stage.key === "Custodian") {
      const isComplete = isWorkflowStageComplete(stage.status);

      return {
        ...stage,
        label: isComplete ? "Custodian" : "Custodian Payment",
        paidAmount:
          isComplete && custodianPaid > 0
            ? formatMoneyAmount(custodianPaid)
            : null,
      };
    }

    if (stage.key === "SENT" && stage.status === "sent") {
      return {
        ...stage,
        showResend: Boolean(order.invoice?.invoiceId),
        invoiceId: order.invoice?.invoiceId || null,
      };
    }

    return stage;
  });
}

function isInactiveOrderStatus(status) {
  return status === "Cancelled" || status === "Deleted";
}

function toRenderOrder(order) {
  return {
    id: order.id,
    dbId: order.dbId,
    orderStatus: order.status || "",
    isSubpoena: Boolean(order.isSubpoena),
    isRecords: Boolean(order.isRecords),
    isWriteOffs: Boolean(order.isWriteOffs),
    hasMedicalRecords: Boolean(order.records?.hasMedicalRecords),
    note: order.note,
    subpoena: order.subpoena,
    hasSubpoenaFile: Boolean(order.hasSubpoenaFile),
    court: order.court || "",
    applicant: order.applicant || "",
    orderRef: order.orderRef || "",
    providerName: order.providerName || "",
    providerEmail: order.providerEmail || order.invoice?.providerEmail || "",
    status: buildWorkflowStagesForOrder(order),
    invoice: order.invoice || { createOnly: true },
    records: order.records || { title: "Records", lines: [], links: [] },
    company: order.company || { name: "—", address: "", phone: "", email: "" },
    facilityInfo: order.facilityInfo || {
      name: order.facilityName || "",
      address: "",
      addressLines: [],
    },
    certificateNoRecords: Boolean(order.certificateNoRecords),
    cnrDelivery: order.cnrDelivery || "",
    mailSentDate: order.readyDate || order.mailSentDate || "",
    readyDate: order.readyDate || "",
    deliveryDate: order.deliveryDate || "",
    pickupPersonName: order.pickupPersonName || "",
    cnrDateSent: order.cnrDateSent || "",
    year: order.year || "",
    dob: order.dob || "",
    ssn: order.ssn || "",
    dobSsn: order.dobSsn || [],
    doiDisplay: order.doiDisplay || "",
    hasDoi: Boolean(order.hasDoi),
    forms: order.forms?.length ? order.forms : DEFAULT_ORDER_FORMS,
  };
}

export default function OrdersTable({ filters = defaultOrderFilters }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [invoiceModalMode, setInvoiceModalMode] = useState("create");
  const [selectedXrayOrder, setSelectedXrayOrder] = useState(null);
  const [selectedCoverSheetOrder, setSelectedCoverSheetOrder] = useState(null);
  const [selectedXrayCoverSheetOrder, setSelectedXrayCoverSheetOrder] =
    useState(null);
  const [selectedCnrOrder, setSelectedCnrOrder] = useState(null);
  const [selectedCertificationOrder, setSelectedCertificationOrder] = useState(null);
  const [selectedCopyLetterOrder, setSelectedCopyLetterOrder] = useState(null);
  const [selectedLogOrder, setSelectedLogOrder] = useState(null);
  const [selectedNoteOrder, setSelectedNoteOrder] = useState(null);
  const [selectedMedicalRecordsOrder, setSelectedMedicalRecordsOrder] =
    useState(null);
  const [selectedPrintInvoiceOrder, setSelectedPrintInvoiceOrder] =
    useState(null);
  const [selectedPrintXrayInvoiceOrder, setSelectedPrintXrayInvoiceOrder] =
    useState(null);
  const [selectedSubpoenaOrder, setSelectedSubpoenaOrder] = useState(null);
  const [selectedMailOrder, setSelectedMailOrder] = useState(null);
  const [selectedPickupOrder, setSelectedPickupOrder] = useState(null);
  const [selectedFaxOrder, setSelectedFaxOrder] = useState(null);
  const [emailingOrderId, setEmailingOrderId] = useState(null);
  const [emailingXrayOrderId, setEmailingXrayOrderId] = useState(null);
  const [resendingOrderId, setResendingOrderId] = useState(null);
  const [processingDeliveryKey, setProcessingDeliveryKey] = useState("");
  const [emailError, setEmailError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, order: null });
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [removeRecordsModal, setRemoveRecordsModal] = useState({
    open: false,
    order: null,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [, setRelativeTimeTick] = useState(0);

  // Guards a silent refetch from running too often, and discards responses
  // from stale requests so a late silent fetch never overwrites fresh data.
  const lastFetchAtRef = useRef(0);
  const requestIdRef = useRef(0);

  const normalizedFilters = {
    facility: filters.facility || "",
    year: filters.year || "",
    status: filters.status || "",
    search: filters.search || "",
  };

  const filterKey = `${normalizedFilters.facility}|${normalizedFilters.year}|${normalizedFilters.status}|${normalizedFilters.search}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const fetchOrders = useCallback(
    async ({ silent = false, force = false } = {}) => {
      if (silent && !force && Date.now() - lastFetchAtRef.current < 5000) return;

      const requestId = (requestIdRef.current += 1);

      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const data = await getOrders({
          facility: normalizedFilters.facility,
          year: normalizedFilters.year,
          status: normalizedFilters.status,
          search: normalizedFilters.search,
        });

        if (requestId !== requestIdRef.current) return;
        setOrders(data.map(toRenderOrder));
        setLastUpdatedAt(new Date());
        setError("");
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (!silent) {
          setError(err.message || "Failed to load orders");
          setOrders([]);
        }
      } finally {
        lastFetchAtRef.current = Date.now();
        if (!silent && requestId === requestIdRef.current) setLoading(false);
      }
    },
    [
      normalizedFilters.facility,
      normalizedFilters.year,
      normalizedFilters.status,
      normalizedFilters.search,
    ]
  );

  function openDeleteModal(order) {
    setActionError("");
    setDeleteModal({ open: true, order });
  }

  function closeDeleteModal() {
    if (actionLoading) return;
    setDeleteModal({ open: false, order: null });
  }

  function openCancelModal(order) {
    setActionError("");
    setCancelModal({ open: true, order });
  }

  function closeCancelModal() {
    if (actionLoading) return;
    setCancelModal({ open: false, order: null });
  }

  function openRemoveRecordsModal(order) {
    setActionError("");
    setRemoveRecordsModal({ open: true, order });
  }

  function closeRemoveRecordsModal() {
    if (actionLoading) return;
    setRemoveRecordsModal({ open: false, order: null });
  }

  async function handleConfirmRemoveRecords() {
    if (!removeRecordsModal.order?.dbId || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      await removeMedicalRecords(removeRecordsModal.order.dbId);
      setRemoveRecordsModal({ open: false, order: null });
      await fetchOrders();
    } catch (err) {
      setActionError(err.message || "Failed to remove medical records");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteModal.order?.dbId) return;

    setActionLoading(true);
    setActionError("");

    try {
      await deleteOrder(deleteModal.order.dbId);
      setDeleteModal({ open: false, order: null });
      await fetchOrders();
    } catch (err) {
      setActionError(err.message || "Failed to delete order");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmCancel(reason) {
    if (!cancelModal.order?.dbId || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      await cancelOrder(cancelModal.order.dbId, { reason });
      setCancelModal({ open: false, order: null });
      await fetchOrders();
    } catch (err) {
      setActionError(err.message || "Failed to cancel order");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!lastUpdatedAt) return undefined;

    const intervalId = window.setInterval(() => {
      setRelativeTimeTick((tick) => tick + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [lastUpdatedAt]);

  const applyInvoiceEmailState = useCallback((orderDbId, updates = {}) => {
    setOrders((prev) =>
      prev.map((item) =>
        item.dbId === orderDbId
          ? {
              ...item,
              invoice: {
                ...item.invoice,
                ...updates,
              },
            }
          : item
      )
    );
  }, []);

  const handleEmailInvoice = useCallback(
    async (order) => {
      if (!order?.dbId || emailingOrderId) return;

      const providerEmail =
        order.providerEmail || order.invoice?.providerEmail || "";

      if (!providerEmail.trim()) {
        setEmailError(NO_PROVIDER_EMAIL_MESSAGE);
        window.alert(NO_PROVIDER_EMAIL_MESSAGE);
        return;
      }

      setEmailError("");
      setEmailingOrderId(order.dbId);

      try {
        const result = await emailInvoiceByOrderId(order.dbId);
        applyInvoiceEmailState(order.dbId, {
          sentDate: result.sentDate,
          sentDateCompact: result.sentDateCompact,
          recipientEmail: result.recipientEmail || result.recipient || "",
        });
        await fetchOrders({ silent: true, force: true });
      } catch (err) {
        setEmailError(err.message || "Failed to email invoice");
      } finally {
        setEmailingOrderId(null);
      }
    },
    [emailingOrderId, fetchOrders, applyInvoiceEmailState]
  );

  const handleEmailXrayInvoice = useCallback(
    async (order) => {
      if (!order?.dbId || emailingXrayOrderId) return;

      const providerEmail =
        order.providerEmail || order.invoice?.providerEmail || "";

      if (!providerEmail.trim()) {
        setEmailError(NO_PROVIDER_EMAIL_MESSAGE);
        window.alert(NO_PROVIDER_EMAIL_MESSAGE);
        return;
      }

      setEmailError("");
      setEmailingXrayOrderId(order.dbId);

      try {
        const result = await emailXrayInvoiceByOrderId(order.dbId);
        applyInvoiceEmailState(order.dbId, {
          xraySentDate: result.xraySentDate,
          xraySentDateCompact: result.xraySentDateCompact,
          recipientEmail: result.recipientEmail || result.recipient || "",
        });
        await fetchOrders({ silent: true, force: true });
      } catch (err) {
        setEmailError(err.message || "Failed to email X-Ray invoice");
      } finally {
        setEmailingXrayOrderId(null);
      }
    },
    [emailingXrayOrderId, fetchOrders, applyInvoiceEmailState]
  );

  const handleResendInvoice = useCallback(
    async (order, invoiceId) => {
      const normalizedInvoiceId = Number(invoiceId);

      if (!order?.dbId || !Number.isFinite(normalizedInvoiceId) || resendingOrderId) {
        return;
      }

      setEmailError("");
      setResendingOrderId(order.dbId);

      try {
        await resendInvoices([normalizedInvoiceId]);
        await fetchOrders({ silent: true });
      } catch (err) {
        setEmailError(err.message || "Failed to resend invoice");
      } finally {
        setResendingOrderId(null);
      }
    },
    [resendingOrderId, fetchOrders]
  );

  const handleMailDelivery = useCallback(
    async (order) => {
      if (!order?.dbId || getDeliveryStatus(order, "mail").completed) return;

      if (!order.hasMedicalRecords) {
        setDeliveryError("Scan medical records before sending mail");
        return;
      }

      const email = resolveProviderEmail(order);
      const mailSentDate = getTodayInputDate();

      if (!email) {
        setSelectedMailOrder(order);
        return;
      }

      const key = `${order.dbId}-mail`;
      setProcessingDeliveryKey(key);
      setDeliveryError("");

      try {
        const result = await mailCompletedOrder(order.dbId, {
          email,
          deliveryDate: mailSentDate,
        });
        const sentDate = result.readyDate || result.sentDate || mailSentDate;
        setOrders((prev) =>
          prev.map((item) =>
            item.dbId === order.dbId
              ? {
                  ...item,
                  orderStatus: "Completed",
                  readyDate: sentDate,
                  mailSentDate: sentDate,
                  deliveryDate: sentDate,
                }
              : item
          )
        );
        await fetchOrders();
      } catch (err) {
        setDeliveryError(err.message || "Failed to send mail");
      } finally {
        setProcessingDeliveryKey("");
      }
    },
    [fetchOrders]
  );

  const applyMailSentState = useCallback((order, sentDate, deliveryDate) => {
    const resolvedDate = sentDate || deliveryDate;
    setOrders((prev) =>
      prev.map((item) =>
        item.dbId === order.dbId
          ? {
              ...item,
              orderStatus: "Completed",
              readyDate: resolvedDate,
              mailSentDate: resolvedDate,
              deliveryDate: resolvedDate,
            }
          : item
      )
    );
  }, []);

  // Refresh workflow/status changes made elsewhere when the user comes back
  // to the tab or window. No polling, so there is no idle network cost.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        fetchOrders({ silent: true });
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [fetchOrders]);

  const filteredOrders = orders;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ORDERS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  if (currentPage !== safeCurrentPage) {
    setCurrentPage(safeCurrentPage);
  }

  const currentOrders = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [safeCurrentPage, filteredOrders]);

  const startRecord =
    filteredOrders.length === 0
      ? 0
      : (safeCurrentPage - 1) * ORDERS_PER_PAGE + 1;

  const endRecord = Math.min(
    safeCurrentPage * ORDERS_PER_PAGE,
    filteredOrders.length
  );

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  };

  return (
    <>
      <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[9px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#F1F5F9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[13px] font-semibold text-[#111827]">
            All Orders
          </h2>

          <p
            className="text-[11px] text-[#94A3B8]"
            title={
              lastUpdatedAt
                ? lastUpdatedAt.toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : undefined
            }
          >
            {loading && !lastUpdatedAt
              ? "Updating..."
              : lastUpdatedAt
                ? `Last updated: ${formatLastUpdatedLabel(lastUpdatedAt)}`
                : ""}
          </p>
        </div>

        {emailError && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-600">
            {emailError}
          </p>
        )}

        {deliveryError && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-600">
            {deliveryError}
          </p>
        )}

        {actionError && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-600">
            {actionError}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1280px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
                <th className="w-[90px] px-4 py-3">ID</th>
                <th className="w-[150px] px-4 py-3">Case</th>
                <th className="w-[125px] px-4 py-3">Status</th>
                <th className="w-[170px] px-4 py-3">Invoice</th>
                <th className="w-[170px] px-4 py-3">Records</th>
                <th className="w-[280px] px-4 py-3">Company</th>
                <th className="w-[110px] px-4 py-3">DOB/SSN/DOI</th>
                <th className="w-[130px] px-4 py-3">Forms</th>
                <th className="w-[120px] px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-[12px] font-medium text-[#94A3B8]"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-[12px] font-semibold text-red-500"
                  >
                    {error}
                  </td>
                </tr>
              ) : currentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-[12px] font-medium text-[#94A3B8]"
                  >
                    No orders match the selected filters.
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
                  <tr
                    key={order.dbId}
                    className="border-b border-[#F1F5F9] text-[11px] text-[#334155] last:border-b-0 hover:bg-[#F8FBFC]"
                  >
                    <td className="px-4 py-5 align-top">
                      <Link
                        href={`/orders/new?mode=edit&orderId=${encodeURIComponent(
                          order.dbId
                        )}`}
                        className="font-semibold text-[#007F96] hover:underline"
                      >
                        {order.id}
                      </Link>

                      {order.year && (
                        <p className="mt-1 text-[10px] font-medium text-[#64748B]">
                          {order.year}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedNoteOrder(order)}
                        className="mt-1 block text-[10px] text-[#007F96] underline"
                      >
                        {order.note ? "Note ●" : "Note"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedLogOrder(order)}
                        className="mt-1 block text-left text-[10px] font-medium text-[#007F96] underline"
                      >
                        Order Log
                      </button>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <p className="font-semibold text-[#111827]">
                        {order.applicant}
                      </p>

                      <p className="mt-1 text-[10px] text-[#64748B]">
                        {order.orderRef}
                      </p>

                      {order.hasSubpoenaFile && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubpoenaOrder(order)}
                          className="mt-2 block text-left text-[10px] font-semibold text-[#059669] hover:underline"
                        >
                          ✓ Subpoena
                        </button>
                      )}

                      {order.court && (
                        <p className="mt-1 text-[10px] font-semibold text-[#334155]">
                          {order.court}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="space-y-1">
                        {order.status.map((stage) => (
                          <WorkflowStageItem
                            key={stage.key || stage.label}
                            stage={stage}
                            href={getWorkflowStageHref(stage, order)}
                            onClick={
                              stage.key === "Review Records" &&
                              order.hasMedicalRecords
                                ? () => setSelectedMedicalRecordsOrder(order)
                                : undefined
                            }
                            onResend={
                              stage.showResend
                                ? () =>
                                    handleResendInvoice(order, stage.invoiceId)
                                : undefined
                            }
                            onRemoveRecords={
                              stage.showRemoveRecords
                                ? () => openRemoveRecordsModal(order)
                                : undefined
                            }
                            removingRecords={
                              actionLoading &&
                              removeRecordsModal.order?.dbId === order.dbId
                            }
                            resending={resendingOrderId === order.dbId}
                          />
                        ))}
                      </div>

                      {(order.orderStatus === "Ready to Pickup" ||
                        order.orderStatus === "Completed") &&
                        (() => {
                        const deliveryActions = getCompletedDeliveryActions(order);
                        const mailStatus = getDeliveryStatus(order, "mail");
                        const faxStatus = getDeliveryStatus(order, "fax");
                        const pickupStatus = getDeliveryStatus(order, "pickup");

                        if (
                          !deliveryActions.mail &&
                          !deliveryActions.fax &&
                          !deliveryActions.pickup
                        ) {
                          return null;
                        }

                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {deliveryActions.mail && (
                              <CompletedDeliveryLink
                                label="Mail"
                                completed={mailStatus.completed}
                                hoverText={mailStatus.hoverText}
                                loading={
                                  processingDeliveryKey === `${order.dbId}-mail`
                                }
                                onClick={() => handleMailDelivery(order)}
                              />
                            )}
                            {deliveryActions.fax && (
                              <CompletedDeliveryLink
                                label="Fax"
                                completed={faxStatus.completed}
                                hoverText={faxStatus.hoverText}
                                onClick={() => setSelectedFaxOrder(order)}
                              />
                            )}
                            {deliveryActions.pickup && (
                              <CompletedDeliveryLink
                                label="Pickup"
                                completed={pickupStatus.completed}
                                hoverText={pickupStatus.hoverText}
                                onClick={() => setSelectedPickupOrder(order)}
                              />
                            )}
                          </div>
                        );
                      })()}

                    </td>

                    <td className="px-4 py-5 align-top">
                      <InvoiceBlock
                        invoice={order.invoice}
                        orderDbId={order.dbId}
                        providerEmail={
                          order.providerEmail ||
                          order.invoice?.providerEmail ||
                          ""
                        }
                        onCreateInvoice={() => {
                          setInvoiceModalMode("create");
                          setSelectedInvoiceOrder(order);
                        }}
                        onReviewInvoice={() => {
                          setInvoiceModalMode("edit");
                          setSelectedInvoiceOrder({
                            ...order,
                            invoiceId: order.invoice?.invoiceId,
                            invoice: {
                              ...order.invoice,
                              invoiceId: order.invoice?.invoiceId,
                            },
                          });
                        }}
                        onCreateXrayInvoice={() => setSelectedXrayOrder(order)}
                        onReviewXrayInvoice={() => setSelectedXrayOrder(order)}
                        onCoverSheet={() => setSelectedCoverSheetOrder(order)}
                        onXrayCoverSheet={() =>
                          setSelectedXrayCoverSheetOrder(order)
                        }
                        onEmailInvoice={() => handleEmailInvoice(order)}
                        onEmailXrayInvoice={() => handleEmailXrayInvoice(order)}
                        onPrintInvoice={() => setSelectedPrintInvoiceOrder(order)}
                        onPrintXrayInvoice={() =>
                          setSelectedPrintXrayInvoiceOrder(order)
                        }
                        emailing={emailingOrderId === order.dbId}
                        emailingXray={emailingXrayOrderId === order.dbId}
                      />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <RecordsBlock records={order.records} />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <CompanyBlock company={order.company} />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="space-y-1 text-[11px] text-[#334155]">
                        {order.dob ? <p>{order.dob}</p> : null}
                        {order.ssn ? <p>{order.ssn}</p> : null}
                        {order.hasDoi ? (
                          <p>{order.doiDisplay}</p>
                        ) : (
                          <Link
                            href={`/orders/new?mode=edit&orderId=${encodeURIComponent(
                              order.dbId
                            )}`}
                            className="font-semibold text-red-500 hover:underline"
                          >
                            No DOI
                          </Link>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <FormsList
                        forms={order.forms}
                        onCnrClick={() => setSelectedCnrOrder(order)}
                        onCertificationClick={() => setSelectedCertificationOrder(order)}
                        onCopyLetterClick={() => setSelectedCopyLetterOrder(order)}
                      />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="flex flex-col items-start gap-2">
                        {!isInactiveOrderStatus(order.orderStatus) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(order)}
                              className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                            >
                              <TrashIcon />
                              Delete
                            </button>

                            <button
                              type="button"
                              onClick={() => openCancelModal(order)}
                              className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-[11px] font-semibold transition hover:opacity-85"
                              style={{
                                border: "1px solid #FCD34D",
                                backgroundColor: "#FFFBEB",
                                color: "#B45309",
                              }}
                            >
                              <SmallCircleIcon />
                              Cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#64748B]">
            Showing {startRecord}-{endRecord} of {filteredOrders.length} orders
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={safeCurrentPage === 1}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] px-2 text-[12px] font-semibold ${
                    safeCurrentPage === page
                      ? "bg-[#111827] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              type="button"
              onClick={goToNextPage}
              disabled={
                safeCurrentPage === totalPages || filteredOrders.length === 0
              }
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        mode={invoiceModalMode}
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        onSaved={fetchOrders}
      />

      <CreateXrayInvoiceModal
        isOpen={Boolean(selectedXrayOrder)}
        order={selectedXrayOrder}
        onClose={() => setSelectedXrayOrder(null)}
        onSaved={fetchOrders}
      />

      <CoverSheetModal
        isOpen={Boolean(selectedCoverSheetOrder)}
        order={selectedCoverSheetOrder}
        onClose={() => setSelectedCoverSheetOrder(null)}
      />

      <XrayCoverSheetModal
        isOpen={Boolean(selectedXrayCoverSheetOrder)}
        order={selectedXrayCoverSheetOrder}
        onClose={() => setSelectedXrayCoverSheetOrder(null)}
      />

      <CertificateNoRecordsModal
        isOpen={Boolean(selectedCnrOrder)}
        order={selectedCnrOrder}
        onClose={() => setSelectedCnrOrder(null)}
      />

      <CertificateOfRecordsModal
        isOpen={Boolean(selectedCertificationOrder)}
        order={selectedCertificationOrder}
        onClose={() => setSelectedCertificationOrder(null)}
      />

      <SendCopyLetterModal
        isOpen={Boolean(selectedCopyLetterOrder)}
        order={selectedCopyLetterOrder}
        onClose={() => setSelectedCopyLetterOrder(null)}
        onSent={async (payload) => {
          const result = await sendCopyServiceLetter(
            selectedCopyLetterOrder.dbId,
            payload
          );
          return result;
        }}
      />

      <OrderActivityLogModal
        isOpen={Boolean(selectedLogOrder)}
        order={selectedLogOrder}
        onClose={() => setSelectedLogOrder(null)}
      />

      <OrderNotesModal
        isOpen={Boolean(selectedNoteOrder)}
        order={selectedNoteOrder}
        onClose={() => setSelectedNoteOrder(null)}
      />

      <MedicalRecordsPreviewModal
        isOpen={Boolean(selectedMedicalRecordsOrder)}
        order={selectedMedicalRecordsOrder}
        onClose={() => setSelectedMedicalRecordsOrder(null)}
      />

      <OrderPdfPreviewModal
        isOpen={Boolean(selectedPrintInvoiceOrder)}
        order={selectedPrintInvoiceOrder}
        onClose={() => setSelectedPrintInvoiceOrder(null)}
        title="Print Invoice"
        fileName="Invoice.pdf"
        fetchPdf={fetchOrderPrintInvoicePdf}
        loadingLabel="Generating invoice PDF..."
      />

      <OrderPdfPreviewModal
        isOpen={Boolean(selectedPrintXrayInvoiceOrder)}
        order={selectedPrintXrayInvoiceOrder}
        onClose={() => setSelectedPrintXrayInvoiceOrder(null)}
        title="Print X-Ray Invoice"
        fileName="XRay-Invoice.pdf"
        fetchPdf={fetchOrderPrintXrayInvoicePdf}
        loadingLabel="Generating X-Ray invoice PDF..."
      />

      <OrderPdfPreviewModal
        isOpen={Boolean(selectedSubpoenaOrder)}
        order={selectedSubpoenaOrder}
        onClose={() => setSelectedSubpoenaOrder(null)}
        title="Subpoena"
        fileName="Subpoena.pdf"
        fetchPdf={fetchOrderSubpoenaPdf}
        loadingLabel="Loading subpoena..."
      />

      <OrderMailModal
        isOpen={Boolean(selectedMailOrder)}
        order={selectedMailOrder}
        onClose={() => setSelectedMailOrder(null)}
        onSent={async ({ email, deliveryDate }) => {
          setDeliveryError("");
          const result = await mailCompletedOrder(selectedMailOrder.dbId, {
            email,
            deliveryDate,
          });
          applyMailSentState(
            selectedMailOrder,
            result.readyDate || result.sentDate,
            result.readyDate || result.sentDate
          );
          await fetchOrders();
        }}
      />

      <OrderPickupModal
        isOpen={Boolean(selectedPickupOrder)}
        order={selectedPickupOrder}
        onClose={() => setSelectedPickupOrder(null)}
        onConfirm={async ({ pickupPersonName, pickupDate, notes }) => {
          await recordOrderPickup(selectedPickupOrder.dbId, {
            pickupPersonName,
            pickupDate,
            notes,
          });
          setOrders((prev) =>
            prev.map((item) =>
              item.dbId === selectedPickupOrder.dbId
                ? {
                    ...item,
                    orderStatus: "Completed",
                    deliveryDate: pickupDate,
                    readyDate: pickupDate,
                    pickupPersonName,
                  }
                : item
            )
          );
          await fetchOrders();
        }}
      />

      <OrderFaxModal
        isOpen={Boolean(selectedFaxOrder)}
        order={selectedFaxOrder}
        onClose={() => setSelectedFaxOrder(null)}
        onConfirm={async ({ faxNumber, sentDate, notes }) => {
          await recordOrderFax(selectedFaxOrder.dbId, {
            faxNumber,
            sentDate,
            notes,
          });
          await fetchOrders({ silent: true });
        }}
      />

      <ConfirmModal
        open={deleteModal.open}
        title="Delete Order"
        message="Are you sure you want to delete this order?"
        variant="danger"
        confirmLabel={actionLoading ? "Deleting..." : "Confirm"}
        cancelLabel="Cancel"
        confirmDisabled={actionLoading}
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        open={removeRecordsModal.open}
        title="Remove Medical Records"
        message="Are you sure you want to remove the uploaded medical records for this order?"
        variant="danger"
        confirmLabel={actionLoading ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        confirmDisabled={actionLoading}
        onCancel={closeRemoveRecordsModal}
        onConfirm={handleConfirmRemoveRecords}
      />

      <OrderCancelModal
        open={cancelModal.open}
        order={cancelModal.order}
        loading={actionLoading}
        onClose={closeCancelModal}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}

function OrderPdfPreviewModal({
  isOpen,
  order,
  onClose,
  title,
  fileName,
  fetchPdf,
  loadingLabel = "Loading...",
}) {
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !order?.dbId) {
      setSrc("");
      setError("");
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = "";

    setLoading(true);
    setError("");

    fetchPdf(order.dbId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, order?.dbId, fetchPdf]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[10px] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
            <p className="text-[11px] text-[#64748B]">
              Order #{order?.id || order?.dbId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] px-3 py-1.5 text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-[12px] text-[#64748B]">{loadingLabel}</p>
          ) : error ? (
            <p className="text-[12px] font-medium text-red-500">{error}</p>
          ) : (
            <SubpoenaPreviewContent src={src} name={fileName} />
          )}
        </div>
      </div>
    </div>
  );
}

function MedicalRecordsPreviewModal({ isOpen, order, onClose }) {
  return (
    <OrderPdfPreviewModal
      isOpen={isOpen}
      order={order}
      onClose={onClose}
      title="Medical Records"
      fileName="Medical Records.pdf"
      fetchPdf={fetchOrderMedicalRecordsPdf}
      loadingLabel="Loading medical records..."
    />
  );
}

function getWorkflowStageHref(stage, order) {
  if (stage.key === "Upload Records") {
    const hasMedicalRecords = Boolean(order.hasMedicalRecords);
    const isComplete =
      isWorkflowStageComplete(stage.status) || hasMedicalRecords;

    if (!isComplete) {
      return `/orders/scan-medical-records?orderId=${encodeURIComponent(
        order.dbId
      )}`;
    }
  }

  if (
    stage.key === "Serve" &&
    !isWorkflowStageComplete(stage.status)
  ) {
    return `/orders/new?mode=edit&orderId=${encodeURIComponent(
      order.dbId
    )}&panel=payment`;
  }

  if (
    stage.key === "Custodian" &&
    !isWorkflowStageComplete(stage.status)
  ) {
    return `/orders/new?mode=edit&orderId=${encodeURIComponent(
      order.dbId
    )}&panel=payment`;
  }

  return null;
}

function WorkflowStageItem({
  stage,
  onClick,
  href,
  onResend,
  onRemoveRecords,
  resending = false,
  removingRecords = false,
}) {
  if (stage.actionLink && href) {
    return (
      <Link
        href={href}
        className="block text-[10px] font-semibold text-[#007F96] underline"
      >
        {stage.label}
      </Link>
    );
  }

  const style = WORKFLOW_STATUS_STYLES[stage.status] || WORKFLOW_STATUS_STYLES.pending;

  if (stage.showRemoveRecords) {
    return (
      <div
        className={`flex w-full flex-nowrap items-center gap-1.5 text-[10px] font-semibold ${style.text}`}
      >
        <WorkflowStageIcon status={stage.status} />
        <span className="min-w-0 flex-1 truncate">{stage.label}</span>
        <button
          type="button"
          onClick={onRemoveRecords}
          disabled={removingRecords || !onRemoveRecords}
          className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded text-red-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Remove medical records"
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  const className = `flex w-full items-center justify-between gap-2 text-left text-[10px] font-semibold ${style.text} ${
    onClick || href ? "cursor-pointer hover:underline" : ""
  }`;

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <WorkflowStageIcon status={stage.status} />
        <span>{stage.label}</span>
      </span>
      {stage.paidAmount ? (
        <span className="shrink-0 font-semibold text-[#059669]">
          {stage.paidAmount}
        </span>
      ) : null}
    </>
  );

  const stageRow =
    href ? (
      <Link href={href} className={className}>
        {content}
      </Link>
    ) : onClick ? (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );

  if (!stage.showResend) {
    return stageRow;
  }

  return (
    <div className="space-y-0.5">
      {stageRow}
      <button
        type="button"
        onClick={onResend}
        disabled={resending || !onResend}
        className="ml-4 block text-[9px] italic text-[#2563EB] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resending ? "sending..." : "resend"}
      </button>
    </div>
  );
}

function WorkflowStageIcon({ status }) {
  if (status === "complete" || status === "sent") {
    const color = status === "sent" ? "text-[#2563EB]" : "text-[#059669]";

    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={`shrink-0 ${color}`}
      >
        <path
          d="M5 12l4 4L19 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const style = WORKFLOW_STATUS_STYLES[status] || WORKFLOW_STATUS_STYLES.pending;

  return (
    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${style.dot}`} />
  );
}

function InvoiceBlock({
  invoice,
  orderDbId,
  providerEmail = "",
  onCreateInvoice,
  onReviewInvoice,
  onCreateXrayInvoice,
  onReviewXrayInvoice,
  onCoverSheet,
  onXrayCoverSheet,
  onEmailInvoice,
  onEmailXrayInvoice,
  onPrintInvoice,
  onPrintXrayInvoice,
  emailing = false,
  emailingXray = false,
}) {
  const hasProviderEmail = Boolean(providerEmail?.trim());
  const invoiceSentDate =
    invoice.sentDateCompact || invoice.sentDate || null;
  const xraySentDate =
    invoice.xraySentDateCompact || invoice.xraySentDate || null;

  const emailInvoiceButton = !invoice.sentDate ? (
    <div className="space-y-0.5">
      {hasProviderEmail ? (
        <p className="truncate text-[#94A3B8]">To: {providerEmail}</p>
      ) : (
        <MissingProviderEmailNotice orderDbId={orderDbId} />
      )}
      <button
        type="button"
        onClick={onEmailInvoice}
        disabled={emailing}
        className="block text-left text-[#007F96] underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {emailing ? "Sending..." : "Email Invoice"}
      </button>
    </div>
  ) : null;

  const invoiceEmailedStatus = invoice.sentDate ? (
    <InvoiceEmailedStatus
      label="Invoice Emailed"
      sentDate={invoiceSentDate}
      recipientEmail={providerEmail || invoice.recipientEmail}
    />
  ) : null;

  const xraySection = invoice.hasXray ? (
    <>
      <InvoiceReviewRows
        label={
          <button
            type="button"
            onClick={onReviewXrayInvoice}
            className="text-[#007F96] underline"
          >
            Review Xray Invoice
          </button>
        }
        dateCompact={invoice.xrayReviewDateCompact || invoice.xrayReviewDate}
        dueAmount={invoice.xrayReviewAmount}
      />

      <button
        type="button"
        onClick={onPrintXrayInvoice}
        className="block text-left text-[#007F96] underline"
      >
        Print Xray Invoice
      </button>

      <button
        type="button"
        onClick={onXrayCoverSheet}
        className="block text-left text-[#007F96] underline"
      >
        X-ray Cover Sheet
      </button>

      {!invoice.xraySentDate ? (
        <div className="space-y-0.5">
          {hasProviderEmail ? (
            <p className="truncate text-[#94A3B8]">To: {providerEmail}</p>
          ) : (
            <MissingProviderEmailNotice orderDbId={orderDbId} />
          )}
          <button
            type="button"
            onClick={onEmailXrayInvoice}
            disabled={emailingXray}
            className="block text-left text-[#007F96] underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {emailingXray ? "Sending..." : "Email Xray Invoice"}
          </button>
        </div>
      ) : null}

      {invoice.xraySentDate ? (
        <InvoiceEmailedStatus
          label="Xray Invoice Emailed"
          sentDate={xraySentDate}
          recipientEmail={providerEmail || invoice.recipientEmail}
        />
      ) : null}
    </>
  ) : (
    <button
      type="button"
      onClick={onCreateXrayInvoice}
      className="block text-left text-[#007F96] underline"
    >
      Create Xray Invoice
    </button>
  );

  if (invoice.createOnly) {
    return (
      <div className="space-y-1 text-[10px]">
        <button
          type="button"
          onClick={onCreateInvoice}
          className="block text-left text-[#007F96] underline"
        >
          Create Invoice
        </button>

        <button
          type="button"
          onClick={onCoverSheet}
          className="block text-left text-[#007F96] underline"
        >
          Cover Sheet
        </button>

        {emailInvoiceButton}
        {invoiceEmailedStatus}
        {xraySection}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[10px]">
      <InvoiceReviewRows
        label={
          <button
            type="button"
            onClick={onReviewInvoice}
            className="text-[#007F96] underline"
          >
            Review Invoice
          </button>
        }
        dateCompact={invoice.invoiceDateCompact || invoice.reviewDate}
        dueAmount={invoice.due}
      />

      <button
        type="button"
        onClick={onPrintInvoice}
        className="block text-left text-[#007F96] underline"
      >
        Print Invoice
      </button>

      <button
        type="button"
        onClick={onCoverSheet}
        className="block text-left text-[#007F96] underline"
      >
        Cover Sheet
      </button>

      {emailInvoiceButton}
      {invoiceEmailedStatus}
      {xraySection}
    </div>
  );
}

function MissingProviderEmailNotice({ orderDbId }) {
  if (!orderDbId) {
    return (
      <p className="text-[10px] font-semibold text-amber-600">
        No provider email. Edit order to add email.
      </p>
    );
  }

  return (
    <p className="text-[10px] font-semibold text-amber-600">
      No provider email.{" "}
      <Link
        href={`/orders/new?mode=edit&orderId=${encodeURIComponent(orderDbId)}`}
        className="text-[#007F96] underline"
      >
        Edit order
      </Link>{" "}
      to add email.
    </p>
  );
}

function InvoiceEmailedStatus({ label, sentDate, recipientEmail }) {
  return (
    <div className="space-y-0.5 text-[#334155]">
      <p className="font-semibold text-[#059669]">✓ {label}</p>
      {recipientEmail ? (
        <p className="truncate text-[#94A3B8]">To: {recipientEmail}</p>
      ) : null}
      {sentDate ? (
        <p className="text-[#94A3B8]">Sent: {sentDate}</p>
      ) : null}
    </div>
  );
}

function InvoiceReviewRows({ label, dateCompact, dueAmount }) {
  const dueLabel = dateCompact ? `${dateCompact} - Due:` : null;

  return (
    <div className="space-y-0.5">
      <div className="text-[#334155]">{label}</div>
      {dueLabel && dueAmount ? (
        <div className="flex w-full items-center justify-between gap-2 text-[#334155]">
          <span className="min-w-0 text-left">{dueLabel}</span>
          <span className="shrink-0 text-right">{dueAmount}</span>
        </div>
      ) : null}
    </div>
  );
}

function InvoiceMoneyRow({ label, date, amount, amountClassName = "" }) {
  return (
    <div className="flex w-full items-center justify-between gap-2 text-[#334155]">
      <span className="min-w-0">{label}</span>
      {amount ? (
        <span
          className={`shrink-0 text-right ${
            amountClassName || "font-semibold text-[#111827]"
          }`}
        >
          {date ? (
            <>
              <span className="font-normal text-[#94A3B8]">{date}</span>{" "}
            </>
          ) : null}
          {amount}
        </span>
      ) : null}
    </div>
  );
}

function RecordsBlock({ records }) {
  return (
    <div className="space-y-1 text-[10px]">
      <p className="font-semibold text-[#111827]">{records.title}</p>

      {records.lines.map((line) => (
        <p key={line} className="text-[#334155]">
          {line}
        </p>
      ))}
    </div>
  );
}

function CompanyBlock({ company }) {
  return (
    <div className="space-y-1 text-[10px] leading-[15px]">
      <p className="font-semibold text-[#007F96]">{company.name}</p>
      <p className="text-[#334155]">{company.address}</p>
      <p className="text-[#64748B]">{company.phone}</p>
      <p className="text-[#64748B]">{company.email}</p>
    </div>
  );
}

function FormsList({ forms, onCnrClick, onCertificationClick, onCopyLetterClick }) {
  const handlers = {
    CNR: onCnrClick,
    "Certification of Records": onCertificationClick,
    "Send Copy/Letter": onCopyLetterClick,
  };

  return (
    <div className="space-y-1">
      {forms.map((form) => (
        <button
          key={form}
          type="button"
          onClick={handlers[form]}
          disabled={!handlers[form]}
          className={`block text-left text-[10px] font-medium underline ${
            handlers[form]
              ? "text-[#007F96] hover:opacity-80"
              : "cursor-default text-[#94A3B8] no-underline"
          }`}
        >
          {form}
        </button>
      ))}
    </div>
  );
}

function formatLastUpdatedLabel(date) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 15) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmallCircleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}