"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";

const invoiceGroups = [
  {
    company: "Smith & Associates",
    emails: "billing@smithassociates.com, accounts@smithassociates.com",
    rows: [
      {
        id: "smith-71956-4",
        caseNo: "71956-4",
        sentDate: "03/18/2026",
        days: 74,
        invDate: "03/18/2026",
        invoiced: "$1,250.00",
        paid: "$400.00",
        due: "$850.00",
      },
      {
        id: "smith-71956-5",
        caseNo: "71956-5",
        sentDate: "04/01/2026",
        days: 60,
        invDate: "04/01/2026",
        invoiced: "$850.00",
        paid: "$0.00",
        due: "$850.00",
      },
      {
        id: "smith-71956-6",
        caseNo: "71956-6",
        sentDate: "04/15/2026",
        days: 46,
        invDate: "04/15/2026",
        invoiced: "$2,100.00",
        paid: "$1,200.00",
        due: "$900.00",
      },
      {
        id: "smith-71956-7",
        caseNo: "71956-7",
        sentDate: "05/02/2026",
        days: 29,
        invDate: "05/02/2026",
        invoiced: "$975.00",
        paid: "$0.00",
        due: "$975.00",
      },
    ],
    total: {
      invoiced: "$5,175.00",
      paid: "$1,600.00",
      due: "$3,575.00",
    },
  },
  {
    company: "Martinez Legal Group",
    emails: "invoices@martinezlegal.com",
    rows: [
      {
        id: "martinez-72001-1",
        caseNo: "72001-1",
        sentDate: "02/10/2026",
        days: 110,
        invDate: "02/10/2026",
        invoiced: "$3,200.00",
        paid: "$2,000.00",
        due: "$1,200.00",
      },
      {
        id: "martinez-72001-2",
        caseNo: "72001-2",
        sentDate: "03/25/2026",
        days: 67,
        invDate: "03/25/2026",
        invoiced: "$1,800.00",
        paid: "$500.00",
        due: "$1,300.00",
      },
      {
        id: "martinez-72001-3",
        caseNo: "72001-3",
        sentDate: "04/20/2026",
        days: 41,
        invDate: "04/20/2026",
        invoiced: "$450.00",
        paid: "$0.00",
        due: "$450.00",
      },
    ],
    total: {
      invoiced: "$5,450.00",
      paid: "$2,500.00",
      due: "$2,950.00",
    },
  },
  {
    company: "Pacific Law Partners",
    emails: "billing@pacificlaw.com, ar@pacificlaw.com",
    rows: [
      {
        id: "pacific-72012-1",
        caseNo: "72012-1",
        sentDate: "01/05/2026",
        days: 146,
        invDate: "01/05/2026",
        invoiced: "$2,750.00",
        paid: "$2,750.00",
        due: "$0.00",
      },
      {
        id: "pacific-72012-2",
        caseNo: "72012-2",
        sentDate: "03/10/2026",
        days: 82,
        invDate: "03/10/2026",
        invoiced: "$1,500.00",
        paid: "$0.00",
        due: "$1,500.00",
      },
      {
        id: "pacific-72012-3",
        caseNo: "72012-3",
        sentDate: "04/28/2026",
        days: 33,
        invDate: "04/28/2026",
        invoiced: "$925.00",
        paid: "$300.00",
        due: "$625.00",
      },
    ],
    total: {
      invoiced: "$5,175.00",
      paid: "$3,050.00",
      due: "$2,125.00",
    },
  },
];

export default function InvoiceReportTable() {
  const [selectedRows, setSelectedRows] = useState({});
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);

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

  const handleSendInvoice = (group) => {
    const selectedIds = selectedRows[group.company] || [];
    const selectedInvoices = group.rows.filter((row) =>
      selectedIds.includes(row.id)
    );

    console.log("Send selected invoices:", {
      company: group.company,
      invoices: selectedInvoices,
    });
  };

  const handleWriteoffInvoice = (group) => {
    const selectedIds = selectedRows[group.company] || [];
    const selectedInvoices = group.rows.filter((row) =>
      selectedIds.includes(row.id)
    );

    console.log("Writeoff selected invoices:", {
      company: group.company,
      invoices: selectedInvoices,
    });
  };

  const handleOpenInvoiceModal = (group, row) => {
    setSelectedInvoiceOrder({
      id: row.caseNo,
      applicant: row.caseNo,
      court: "N/A",
      company: {
        name: group.company,
      },
      invoice: {
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
              {invoiceGroups.map((group) => {
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
                    onToggleRow={handleToggleRow}
                    onToggleGroup={handleToggleGroup}
                    onSendInvoice={handleSendInvoice}
                    onWriteoffInvoice={handleWriteoffInvoice}
                    onOpenInvoiceModal={handleOpenInvoiceModal}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        mode="edit"
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
      />
    </>
  );
}

function InvoiceGroup({
  group,
  selectedIds,
  allSelected,
  onToggleRow,
  onToggleGroup,
  onSendInvoice,
  onWriteoffInvoice,
  onOpenInvoiceModal,
}) {
  const hasSelected = selectedIds.length > 0;

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
              disabled={!hasSelected}
              onClick={() => onSendInvoice(group)}
              className={`h-[30px] whitespace-nowrap rounded-[6px] px-4 text-[11px] font-semibold transition ${
                hasSelected
                  ? "bg-[#0097B2] text-white hover:bg-[#0086A0]"
                  : "cursor-not-allowed bg-[#EFF6FF] text-[#94A3B8]"
              }`}
            >
              Send Invoice
            </button>

            <button
              type="button"
              disabled={!hasSelected}
              onClick={() => onWriteoffInvoice(group)}
              className={`h-[30px] whitespace-nowrap rounded-[6px] px-4 text-[11px] font-semibold transition ${
                hasSelected
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
}) {
  return (
    <tr className="border-b border-[#F1F5F9] bg-white hover:bg-[#F8FAFC]">
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
              row.caseNo
            )}`}
            className="whitespace-nowrap font-semibold text-[#007F96] hover:underline"
          >
            {row.caseNo}
          </Link>

          <span className="ml-2 text-[#94A3B8]">invoice sent</span>

          <button
            type="button"
            onClick={() => onOpenInvoiceModal(group, row)}
            className="ml-1 whitespace-nowrap font-medium text-red-500 hover:underline"
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
          onClick={() => console.log("Writeoff invoice:", row)}
          className="h-[28px] whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
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