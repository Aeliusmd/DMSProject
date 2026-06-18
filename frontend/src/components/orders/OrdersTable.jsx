"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import CreateXrayInvoiceModal from "@/components/orders/CreateXrayInvoiceModal";
import CoverSheetModal from "@/components/orders/CoverSheetModal";
import XrayCoverSheetModal from "@/components/orders/XrayCoverSheetModal";
import CertificateNoRecordsModal from "@/components/orders/CertificateNoRecordsModal";
import OrderActivityLogModal from "@/components/orders/OrderActivityLogModal";
import OrderNotesModal from "@/components/orders/OrderNotesModal";
import { getOrders } from "@/lib/orders/orderApi";

const ORDERS_PER_PAGE = 6;

const defaultOrderFilters = {
  facility: "",
  year: "",
  status: "",
  search: "",
};

const DEFAULT_ORDER_FORMS = [
  "Send Copy/Letter",
  "Copy Center",
  "Certification",
  "Records",
  "CNR",
  "Called",
  "Edit Order",
];

const WORKFLOW_STAGES = ["Review Records", "Serve", "Custodian", "SENT"];

const WORKFLOW_STATUS_STYLES = {
  complete: { text: "text-[#059669]", dot: "bg-[#10B981]" },
  failed: { text: "text-red-500", dot: "bg-red-500" },
  pending: { text: "text-[#CA8A04]", dot: "bg-[#EAB308]" },
  sent: { text: "text-[#2563EB]", dot: "bg-[#3B82F6]" },
};

function mapWorkflowStages(stages = []) {
  const byName = new Map(
    stages.map((stage) => [stage.stageName, stage.stageStatus])
  );

  return WORKFLOW_STAGES.map((stageName) => {
    const status = byName.get(stageName) || "pending";

    return {
      label: stageName,
      status,
    };
  });
}

function toRenderOrder(order) {
  return {
    id: order.id,
    dbId: order.dbId,
    note: order.note,
    subpoena: order.subpoena,
    court: order.court || "",
    applicant: order.applicant || "",
    orderRef: order.orderRef || "",
    status: mapWorkflowStages(order.workflowStages),
    invoice: order.invoice || { createOnly: true },
    records: order.records || { title: "Records", lines: [], links: [] },
    company: order.company || { name: "—", address: "", phone: "", email: "" },
    dobSsn: order.dobSsn || [],
    forms: order.forms?.length ? order.forms : DEFAULT_ORDER_FORMS,
  };
}

export default function OrdersTable({ filters = defaultOrderFilters }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [invoiceModalMode, setInvoiceModalMode] = useState("create");
  const [selectedXrayOrder, setSelectedXrayOrder] = useState(null);
  const [selectedCoverSheetOrder, setSelectedCoverSheetOrder] = useState(null);
  const [selectedXrayCoverSheetOrder, setSelectedXrayCoverSheetOrder] =
    useState(null);
  const [selectedCnrOrder, setSelectedCnrOrder] = useState(null);
  const [selectedLogOrder, setSelectedLogOrder] = useState(null);
  const [selectedNoteOrder, setSelectedNoteOrder] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    async ({ silent = false } = {}) => {
      // A silent (focus-triggered) refetch is skipped if we just fetched,
      // so returning to the tab repeatedly never spams the API.
      if (silent && Date.now() - lastFetchAtRef.current < 5000) return;

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

          <p className="text-[11px] text-[#94A3B8]">Last updated: 6/2/2026</p>
        </div>

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
                <th className="w-[95px] px-4 py-3">DOB/SSN</th>
                <th className="w-[130px] px-4 py-3">Forms</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[12px] font-medium text-[#94A3B8]"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[12px] font-semibold text-red-500"
                  >
                    {error}
                  </td>
                </tr>
              ) : currentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
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

                      {order.subpoena && (
                        <p className="mt-1 text-[10px] font-semibold text-[#059669]">
                          ✓ Subpoena
                        </p>
                      )}

                      {order.court && (
                        <p className="mt-1 text-[10px] font-semibold text-[#334155]">
                          {order.court}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-5 align-top">
                      <p className="font-semibold text-[#111827]">
                        {order.applicant}
                      </p>

                      <p className="mt-1 text-[10px] text-[#64748B]">
                        {order.orderRef}
                      </p>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="space-y-1">
                        {order.status.map((stage) => (
                          <WorkflowStageItem key={stage.label} stage={stage} />
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <InvoiceBlock
                        invoice={order.invoice}
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
                        {order.dobSsn.map((item) => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <FormsList
                        forms={order.forms}
                        onCnrClick={() => setSelectedCnrOrder(order)}
                        onEditClick={() =>
                          router.push(
                            `/orders/new?mode=edit&orderId=${encodeURIComponent(
                              order.dbId
                            )}`
                          )
                        }
                      />
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
    </>
  );
}

function WorkflowStageItem({ stage }) {
  const style = WORKFLOW_STATUS_STYLES[stage.status] || WORKFLOW_STATUS_STYLES.pending;

  return (
    <div
      className={`flex items-center gap-1.5 text-left text-[10px] font-semibold ${style.text}`}
    >
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${style.dot}`} />

      {stage.label}
    </div>
  );
}

function InvoiceBlock({
  invoice,
  onCreateInvoice,
  onReviewInvoice,
  onCreateXrayInvoice,
  onReviewXrayInvoice,
  onCoverSheet,
  onXrayCoverSheet,
}) {
  const xrayReviewLine = invoice.hasXray ? (
    <p className="text-[#334155]">
      <button
        type="button"
        onClick={onReviewXrayInvoice}
        className="text-[#007F96] underline"
      >
        Review Xray Invoice
      </button>{" "}
      <span className="text-[#94A3B8]">{invoice.xrayReviewDate}</span>{" "}
      <span className="text-[#111827]">{invoice.xrayReviewAmount}</span>
    </p>
  ) : (
    <button
      type="button"
      onClick={onCreateXrayInvoice}
      className="block text-[#007F96] underline"
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
          className="block text-[#007F96] underline"
        >
          Create Invoice
        </button>

        <button
          type="button"
          onClick={onCoverSheet}
          className="block text-[#007F96] underline"
        >
          Cover Sheet
        </button>

        <button
          type="button"
          onClick={onXrayCoverSheet}
          className="block text-[#007F96] underline"
        >
          X-ray Cover Sheet
        </button>

        {xrayReviewLine}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[10px]">
      <p className="text-[#334155]">
        <button
          type="button"
          onClick={onReviewInvoice}
          className="text-[#007F96] underline"
        >
          Review Invoice
        </button>{" "}
        <span className="text-[#94A3B8]">{invoice.reviewDate}</span>{" "}
        <span className="text-[#111827]">{invoice.reviewAmount}</span>
      </p>

      <p className="text-[#334155]">
        <button type="button" className="text-[#007F96] underline">
          Print Invoice
        </button>{" "}
        <span>{invoice.printAmount}</span>
      </p>

      {invoice.custodianAmount && (
        <p className="text-[#334155]">
          Custodian{" "}
          <span className="font-semibold">{invoice.custodianAmount}</span>
        </p>
      )}

      {invoice.sentDate && (
        <p className="font-semibold text-[#059669]">
          ✓ SENT {invoice.sentDate}
        </p>
      )}

      <button
        type="button"
        onClick={onCoverSheet}
        className="block text-[#007F96] underline"
      >
        Cover Sheet
      </button>

      <button
        type="button"
        onClick={onXrayCoverSheet}
        className="block text-[#007F96] underline"
      >
        X-ray Cover Sheet
      </button>

      {xrayReviewLine}

      {invoice.showEmail && (
        <button type="button" className="block text-[#007F96] underline">
          Email Invoice
        </button>
      )}

      {invoice.paid && <p className="font-semibold text-[#059669]">Paid ✓</p>}
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

      {records.links.map((link) => (
        <button
          key={link}
          type="button"
          className="block text-left text-[#007F96] underline"
        >
          {link}
        </button>
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

function FormsList({ forms, onCnrClick, onEditClick }) {
  const handlers = {
    CNR: onCnrClick,
    "Edit Order": onEditClick,
  };

  return (
    <div className="space-y-1">
      {forms.map((form) => (
        <button
          key={form}
          type="button"
          onClick={handlers[form]}
          className="block text-left text-[10px] font-medium text-[#007F96] underline"
        >
          {form}
        </button>
      ))}
    </div>
  );
}