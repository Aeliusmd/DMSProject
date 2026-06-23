"use client";

import { useState } from "react";
import Link from "next/link";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import WriteOffInvoiceModal from "@/components/invoices/WriteOffInvoiceModal";
import { sendInvoices, writeOffInvoices as submitWriteOffInvoices } from "@/lib/invoices/invoiceApi";
import { canWriteOffInvoice } from "@/lib/invoices/invoiceUtils";

function buildWriteOffInvoice(group, row) {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    orderId: row.orderId,
    caseNo: row.caseNo,
    company: group.company,
    sentDate: row.sentDate,
    invoiceDate: row.invDate,
    invoiced: row.invoiced,
    paid: row.paid,
    due: row.due,
  };
}

export default function InvoiceReportTable({
  invoiceGroups = [],
  loading = false,
  onRefresh,
  onSent,
}) {
  const [selectedRows, setSelectedRows] = useState({});
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [writeOffInvoices, setWriteOffInvoices] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [writeOffError, setWriteOffError] = useState("");

  const handleToggleRow = (company, rowId) => {
    setSelectedRows((prev) => {
      const companySelected = prev[company] || [];
      const isSelected = companySelected.includes(rowId);

      return {
        ...prev,
        [company]: isSelected
          ? companySelected.filter((id) => id !== rowId)
          : [...companySelected, rowId],
      };
    });
  };

  const handleToggleGroup = (group) => {
    setSelectedRows((prev) => {
      const selectedIds = prev[group.company] || [];
      const allRowIds = group.rows.map((row) => row.id);
      const isAllSelected = selectedIds.length === allRowIds.length;

      return {
        ...prev,
        [group.company]: isAllSelected ? [] : allRowIds,
      };
    });
  };

  const handleSendInvoice = async (group) => {
    const selectedIds = selectedRows[group.company] || [];
    const selectedInvoiceRows = group.rows.filter(
      (row) =>
        selectedIds.includes(row.id) && !row.isSent && !row.isWrittenOff
    );

    if (!selectedInvoiceRows.length || sending) {
      if (selectedIds.length && !selectedInvoiceRows.length) {
        const selectedRows = group.rows.filter((row) =>
          selectedIds.includes(row.id)
        );

        if (selectedRows.every((row) => row.isSent)) {
          setSendError("Selected invoices are already sent.");
        } else if (selectedRows.every((row) => row.isWrittenOff)) {
          setSendError("Written off invoices cannot be sent.");
        } else {
          setSendError("Selected invoices cannot be sent.");
        }
      }
      return;
    }

    const invoiceIds = selectedInvoiceRows
      .map((row) => Number(row.invoiceId))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!invoiceIds.length) return;

    setSending(true);
    setSendError("");

    try {
      await sendInvoices(invoiceIds);
      setSelectedRows((prev) => ({
        ...prev,
        [group.company]: [],
      }));
      onRefresh?.();
      onSent?.();
    } catch (error) {
      setSendError(error?.message || "Failed to send invoices");
      console.error("Failed to send invoices:", error);
    } finally {
      setSending(false);
    }
  };

  const handleWriteoffInvoice = (group) => {
    const selectedIds = selectedRows[group.company] || [];
    const selectedInvoices = group.rows
      .filter((row) => selectedIds.includes(row.id))
      .filter((row) => canWriteOffInvoice(row))
      .map((row) => buildWriteOffInvoice(group, row));

    if (selectedInvoices.length === 0) return;

    setWriteOffInvoices(selectedInvoices);
  };

  const handleOpenSingleWriteOffModal = (group, row) => {
    if (!canWriteOffInvoice(row)) return;

    setWriteOffInvoices([buildWriteOffInvoice(group, row)]);
  };

  const handleSubmitWriteOff = async (payload) => {
    setWriteOffError("");

    try {
      await submitWriteOffInvoices(payload);

      setSelectedRows((prev) => {
        const next = { ...prev };

        payload.invoices.forEach((invoice) => {
          if (!invoice.company || !next[invoice.company]) return;

          next[invoice.company] = next[invoice.company].filter(
            (rowId) => rowId !== invoice.id
          );
        });

        return next;
      });

      setWriteOffInvoices([]);
      onRefresh?.();
    } catch (error) {
      setWriteOffError(error?.message || "Failed to write off invoices");
      console.error("Failed to write off invoices:", error);
    }
  };

  const handleOpenInvoiceModal = (group, row) => {
    setSelectedInvoiceOrder({
      id: row.caseNo,
      dbId: row.orderId,
      invoiceId: row.invoiceId,
      applicant: row.applicant || row.caseNo,
      court: "N/A",
      company: {
        name: group.company,
      },
      invoice: {
        invoiceId: row.invoiceId,
        date: row.invDate,
        sentDate: row.sentDate,
        invoiced: row.invoiced,
        paid: row.paid,
        due: row.due,
      },
    });
  };

  return (
    <>
      {sendError && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">
          {sendError}
        </p>
      )}

      {writeOffError && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">
          {writeOffError}
        </p>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead className="sticky top-0 z-20 bg-[#F8FAFC]">
              <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
                <th className="w-[44px] px-4 py-3"></th>
                <th className="w-[210px] px-4 py-3">All Company</th>
                <th className="w-[300px] px-4 py-3">Email</th>
                <th className="w-[210px] px-4 py-3">Case</th>
                <th className="w-[125px] px-4 py-3">Inv Date</th>
                <th className="w-[130px] px-4 py-3 text-right">Invoiced</th>
                <th className="w-[130px] px-4 py-3 text-right">Paid</th>
                <th className="w-[130px] px-4 py-3 text-right">Due</th>
                <th className="w-[110px] px-4 py-3 text-right"></th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                  >
                    Loading invoices...
                  </td>
                </tr>
              )}

              {!loading &&
                invoiceGroups.map((group) => {
                const selectedIds = selectedRows[group.company] || [];
                const allSelected =
                  selectedIds.length === group.rows.length &&
                  group.rows.length > 0;

                return (
                  <InvoiceGroup
                    key={group.company}
                    group={group}
                    selectedIds={selectedIds}
                    allSelected={allSelected}
                    sending={sending}
                    onToggleRow={handleToggleRow}
                    onToggleGroup={handleToggleGroup}
                    onSendInvoice={handleSendInvoice}
                    onWriteoffInvoice={handleWriteoffInvoice}
                    onOpenInvoiceModal={handleOpenInvoiceModal}
                    onOpenSingleWriteOffModal={handleOpenSingleWriteOffModal}
                  />
                );
              })}

              {!loading && invoiceGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                  >
                    No outstanding invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        mode="edit"
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        onSaved={onRefresh}
      />

      <WriteOffInvoiceModal
        isOpen={writeOffInvoices.length > 0}
        invoices={writeOffInvoices}
        onClose={() => setWriteOffInvoices([])}
        onSubmit={handleSubmitWriteOff}
      />
    </>
  );
}

function InvoiceGroup({
  group,
  selectedIds,
  allSelected,
  sending,
  onToggleRow,
  onToggleGroup,
  onSendInvoice,
  onWriteoffInvoice,
  onOpenInvoiceModal,
  onOpenSingleWriteOffModal,
}) {
  const hasSelected = selectedIds.length > 0;
  const hasWritableSelected = group.rows.some(
    (row) => selectedIds.includes(row.id) && canWriteOffInvoice(row)
  );

  return (
    <>
      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <td className="px-4 py-4 align-top"></td>

        <td className="px-4 py-4 align-top">
          <p className="max-w-[170px] text-[12px] font-semibold leading-[20px] text-[#111827]">
            {group.company}
          </p>
        </td>

        <td className="px-4 py-4 align-top">
          <p className="max-w-[260px] break-words text-[12px] leading-[20px] text-[#64748B]">
            {group.emails}
          </p>
        </td>

        <td colSpan={6}></td>
      </tr>

      {group.rows.map((row) => (
        <InvoiceRow
          key={row.id}
          group={group}
          row={row}
          checked={selectedIds.includes(row.id)}
          onToggleRow={onToggleRow}
          onOpenInvoiceModal={onOpenInvoiceModal}
          onOpenSingleWriteOffModal={onOpenSingleWriteOffModal}
        />
      ))}

      <tr className="border-b border-[#CBD5E1] bg-white">
        <td className="px-4 py-4 align-middle">
          <InvoiceCheckbox
            checked={allSelected}
            onChange={() => onToggleGroup(group)}
          />
        </td>

        <td colSpan={4} className="px-4 py-4 align-middle">
          <div className="flex min-w-max items-center gap-3">
            <span className="text-[12px] font-medium text-[#64748B]">All</span>

            <button
              type="button"
              disabled={!hasSelected || sending}
              onClick={() => onSendInvoice(group)}
              className={`h-[30px] whitespace-nowrap rounded-[6px] px-4 text-[11px] font-semibold transition ${
                hasSelected && !sending
                  ? "bg-[#0097B2] text-white hover:bg-[#0086A0]"
                  : "cursor-not-allowed bg-[#EFF6FF] text-[#94A3B8]"
              }`}
            >
              {sending ? "Sending..." : "Send Invoice"}
            </button>

            <button
              type="button"
              disabled={!hasWritableSelected}
              onClick={() => onWriteoffInvoice(group)}
              className={`h-[30px] whitespace-nowrap rounded-[6px] px-4 text-[11px] font-semibold transition ${
                hasWritableSelected
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "cursor-not-allowed bg-[#EFF6FF] text-[#94A3B8]"
              }`}
            >
              Writeoff Invoice
            </button>
          </div>
        </td>

        <td className="px-4 py-4 text-right text-[12px] font-semibold text-[#111827]">
          {group.total.invoiced}
        </td>

        <td className="px-4 py-4 text-right text-[12px] font-semibold text-[#059669]">
          {group.total.paid}
        </td>

        <td className="px-4 py-4 text-right text-[12px] font-semibold text-red-500">
          {group.total.due}
        </td>

        <td className="px-4 py-4"></td>
      </tr>
    </>
  );
}

function InvoiceRow({
  group,
  row,
  checked,
  onToggleRow,
  onOpenInvoiceModal,
  onOpenSingleWriteOffModal,
}) {
  const rowClassName = row.isWrittenOff
    ? "border-b border-[#F1F5F9] bg-white text-[#94A3B8] line-through hover:bg-[#F8FAFC]"
    : "border-b border-[#F1F5F9] bg-white hover:bg-[#F8FAFC]";

  return (
    <tr className={rowClassName}>
      <td className="px-4 py-4 align-top">
        <InvoiceCheckbox
          checked={checked}
          onChange={() => onToggleRow(group.company, row.id)}
        />
      </td>

      <td className="px-4 py-4"></td>
      <td className="px-4 py-4"></td>

      <td className="px-4 py-4 align-top">
        <div className="max-w-[190px] text-[12px] leading-[20px]">
          <Link
            href={`/orders/new?mode=edit&orderId=${encodeURIComponent(
              row.orderId
            )}`}
            className="whitespace-nowrap font-semibold text-[#007F96] hover:underline"
          >
            {row.caseNo}
          </Link>

          {row.isSent ? (
            <span className="ml-2 text-[#94A3B8]">invoice sent</span>
          ) : (
            <span className="ml-2 text-[#94A3B8]">not sent</span>
          )}

          <button
            type="button"
            onClick={() => onOpenInvoiceModal(group, row)}
            className={`ml-1 whitespace-nowrap font-medium hover:underline ${
              row.isSent ? "text-red-500" : "text-[#475569]"
            }`}
          >
            {row.sentDate}
          </button>

          <span className="ml-1 whitespace-nowrap text-[#64748B]">
            ({row.days} days)
          </span>
        </div>
      </td>

      <td className="px-4 py-4 align-top text-[12px] text-[#334155]">
        <button
          type="button"
          onClick={() => onOpenInvoiceModal(group, row)}
          className="text-[#334155] hover:text-[#007F96] hover:underline"
        >
          {row.invDate}
        </button>
      </td>

      <td className="px-4 py-4 align-top text-right text-[12px] text-[#334155]">
        {row.invoiced}
      </td>

      <td className="px-4 py-4 align-top text-right text-[12px] font-semibold text-[#059669]">
        {row.paid}
      </td>

      <td className="px-4 py-4 align-top text-right text-[12px] font-semibold text-[#111827]">
        {row.due}
      </td>

      <td className="px-4 py-4 align-top text-right">
        <button
          type="button"
          onClick={() => onOpenSingleWriteOffModal(group, row)}
          disabled={!canWriteOffInvoice(row)}
          className="h-[28px] whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Writeoff
        </button>
      </td>
    </tr>
  );
}

function InvoiceCheckbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
    />
  );
}