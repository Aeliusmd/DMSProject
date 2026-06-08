"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import CreateXrayInvoiceModal from "@/components/orders/CreateXrayInvoiceModal";
import CoverSheetModal from "@/components/orders/CoverSheetModal";
import XrayCoverSheetModal from "@/components/orders/XrayCoverSheetModal";
import CertificateNoRecordsModal from "@/components/orders/CertificateNoRecordsModal";
import OrderActivityLogModal from "@/components/orders/OrderActivityLogModal";

const ORDERS_PER_PAGE = 6;

const orderActivityLogs = [
  {
    date: "06/04/26",
    by: "Matthew Perera",
    callback: "",
    note: "Letter CNR Letter emailed to devindiabeykoon@gmail.com, sarasinisala@gmail.com",
  },
  {
    date: "06/04/26",
    by: "Matthew Perera",
    callback: "",
    note: "Per Elizabeth this is a CNR",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Invoice Updated by Matthew Perera on 06/01/2026 02:35AM",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Records Emailed to",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Invoice Updated by Matthew Perera on 06/01/2026 02:27AM",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Invoice Updated by Matthew Perera on 06/01/2026 02:27AM",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Previous Check Entered...",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "XRay Invoice emailed to devindiabeykoon@gmail.com",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Records Sent to devindiabeykoon@gmail.com",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Records Sent to devindiabeykoon@gmail.com",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Matthew Perera updated order on 06/01/2026 02:15AM",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Matthew Perera updated order on 06/01/2026 02:11AM",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Letter CNR Letter emailed to devindiabeykoon@gmail.com",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Letter Copy Service Letter emailed to devindiabeykoon@gmail.com",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Per Elizabeth this is a CNR",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "Records printed and invoices sent out",
  },
  {
    date: "06/01/26",
    by: "Matthew Perera",
    callback: "",
    note: "XRay Invoice emailed to devindiabeykoon@gmail.com",
  },
];

const orders = [
  {
    id: "70656-1",
    note: true,
    subpoena: true,
    court: "WCAB",
    applicant: "Carlos Rivera",
    orderRef: "Ord #W-27285-3",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "red" },
      { label: "SENT", type: "check" },
    ],
    invoice: {
      reviewDate: "05/25",
      reviewAmount: "$285.00",
      printAmount: "$15.00",
      custodianAmount: "$20.00",
      sentDate: "05/26",
      showXray: true,
      showEmail: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL", "04/01/2015 - Present"],
      links: ["Printed/Sent Out Note", "CNR Note"],
    },
    company: {
      name: "CITYWIDE SCANNING SERVICES, Inc.",
      address: "3010 WILSHIRE BLVD SUITE 22, Los Angeles",
      phone: "Phone 213-353-0500 | Fax 213-677-5238",
      email: "Email: records@citywidescanning.com",
    },
    dobSsn: ["04/01/93", "06/01/24", "02/04/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "6443-1",
    note: true,
    subpoena: true,
    court: "WCAB",
    applicant: "Carlos Eduardo Diaz",
    orderRef: "Ord #REC-1630864",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "green" },
      { label: "SENT", type: "check" },
    ],
    invoice: {
      reviewDate: "06/10",
      reviewAmount: "$15.00",
      printAmount: "$24.90",
      custodianAmount: "$6.25",
      sentDate: "06/26",
      paid: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL, FROM", "04/23/2015 - Present"],
      links: ["Printed/Sent Out Note", "CNR Note"],
    },
    company: {
      name: "GEMINI",
      address: "250 TECHNOLOGY WAY, ROCKLIN, Rocklin",
      phone: "Phone 877-739-7481 | Fax 707-204-8527",
      email: "Email: records@geminilegal.com",
    },
    dobSsn: ["07/13/70", "03/29/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Send CNR L",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "65322-1",
    note: true,
    subpoena: false,
    court: "WCAB",
    applicant: "Christian Lopez",
    orderRef: "Ord #REC-1540811",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "green" },
      { label: "SENT", type: "check" },
    ],
    invoice: {
      reviewDate: "07/11",
      reviewAmount: "$15.00",
      printAmount: "$20.00",
      custodianAmount: "$20.00",
      sentDate: "07/11/25",
      showXray: true,
      paid: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL FROM", "05/21/2015 - Present"],
      links: ["Printed/Sent Out Note", "CNR Note"],
    },
    company: {
      name: "Gemini Legal Support, Inc.",
      address: "250 Technology Way, Rocklin",
      phone: "Phone 877-739-7481 | Fax 626-966-9975",
      email: "Email: records@gemini.Legal",
    },
    dobSsn: ["11/22/1944", "04/10/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "70123-2",
    note: true,
    subpoena: false,
    court: "",
    applicant: "Maria Hernandez",
    orderRef: "Ord #REC-187679",
    status: [
      { label: "Review Records", type: "red" },
      { label: "Serve", type: "red" },
      { label: "Custodian", type: "red" },
    ],
    invoice: {
      createOnly: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL", "01/15/2020 - Present"],
      links: ["Upload Subpoena"],
    },
    company: {
      name: "Adventist Health",
      address: "1500 Chevy Chase Dr, Glendale, CA 91206",
      phone: "Phone 818-409-8000 | Fax 818-409-8010",
      email: "Email: records@adventisthealth.org",
    },
    dobSsn: ["03/22/1985", "04/01/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "7157-1",
    note: true,
    subpoena: false,
    court: "",
    applicant: "Robert Kim",
    orderRef: "Ord #W-28934-1",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "red" },
      { label: "SENT", type: "check" },
    ],
    invoice: {
      reviewDate: "04/20",
      reviewAmount: "$45.00",
      printAmount: "$15.00",
      sentDate: "04/20/25",
      showXray: true,
      paid: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL", "06/01/2018 - Present"],
      links: ["Printed/Sent Out Note"],
    },
    company: {
      name: "Cedars-Sinai Medical Center",
      address: "8700 Beverly Blvd, Los Angeles, CA 90048",
      phone: "Phone 310-423-3277 | Fax 310-423-3272",
      email: "Email: records@cedars-sinai.edu",
    },
    dobSsn: ["09/12/1978", "05/15/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "7289-3",
    note: true,
    subpoena: false,
    court: "",
    applicant: "Jennifer Martinez",
    orderRef: "Ord #REC-1923456",
    status: [
      { label: "Review Records", type: "red" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "red" },
    ],
    invoice: {
      createOnly: true,
    },
    records: {
      title: "Medical Records",
      lines: ["ANY N ALL", "03/10/2019 - Present"],
      links: ["Review Subpoena"],
    },
    company: {
      name: "Children's Hospital Los Angeles",
      address: "4650 Sunset Blvd, Los Angeles, CA 90027",
      phone: "Phone 323-660-2450 | Fax 323-660-2451",
      email: "Email: roi@chla.usc.edu",
    },
    dobSsn: ["02/14/2010", "06/20/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "7310-1",
    note: true,
    subpoena: true,
    court: "WCAB",
    applicant: "Angela Foster",
    orderRef: "Ord #W-1938482",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "green" },
      { label: "Custodian", type: "green" },
      { label: "SENT", type: "check" },
    ],
    invoice: {
      reviewDate: "06/02",
      reviewAmount: "$75.00",
      printAmount: "$15.00",
      custodianAmount: "$25.00",
      sentDate: "06/03/25",
      showEmail: true,
    },
    records: {
      title: "Billing Records",
      lines: ["ALL BILLING", "01/01/2020 - Present"],
      links: ["Printed/Sent Out Note", "CNR Note"],
    },
    company: {
      name: "Pacific Diagnostic Center",
      address: "8900 Sunset Blvd, Floor 4, West Hollywood",
      phone: "Phone 310-553-2400 | Fax 310-553-2401",
      email: "Email: records@pacificdiagnostic.com",
    },
    dobSsn: ["05/20/82", "06/02/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
  {
    id: "7422-4",
    note: true,
    subpoena: false,
    court: "",
    applicant: "Michael Brooks",
    orderRef: "Ord #REC-1945520",
    status: [
      { label: "Review Records", type: "green" },
      { label: "Serve", type: "red" },
      { label: "Custodian", type: "green" },
    ],
    invoice: {
      reviewDate: "05/18",
      reviewAmount: "$95.00",
      printAmount: "$20.00",
      sentDate: "05/19/25",
      paid: true,
    },
    records: {
      title: "X-Ray Films",
      lines: ["ANY N ALL", "02/01/2017 - Present"],
      links: ["Printed/Sent Out Note", "CNR Note"],
    },
    company: {
      name: "UCLA Health",
      address: "10833 Le Conte Ave, Los Angeles, CA 90095",
      phone: "Phone 310-825-9111 | Fax 310-825-9820",
      email: "Email: records@uclahealth.org",
    },
    dobSsn: ["09/12/78", "05/15/25"],
    forms: [
      "Send Copy/Letter",
      "Copy Center",
      "Certification",
      "Records",
      "CNR",
      "Called",
      "Edit Order",
    ],
  },
];

export default function OrdersTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedXrayOrder, setSelectedXrayOrder] = useState(null);
  const [selectedCoverSheetOrder, setSelectedCoverSheetOrder] = useState(null);
  const [selectedXrayCoverSheetOrder, setSelectedXrayCoverSheetOrder] =
    useState(null);
  const [selectedCnrOrder, setSelectedCnrOrder] = useState(null);
  const [selectedLogOrder, setSelectedLogOrder] = useState(null);

  const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);

  const currentOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
    return orders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [currentPage]);

  const startRecord = (currentPage - 1) * ORDERS_PER_PAGE + 1;
  const endRecord = Math.min(currentPage * ORDERS_PER_PAGE, orders.length);

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
              {currentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-[#F1F5F9] text-[11px] text-[#334155] last:border-b-0 hover:bg-[#F8FBFC]"
                >
                  <td className="px-4 py-5 align-top">
                    <Link
                      href="/orders/new"
                      className="font-semibold text-[#007F96] hover:underline"
                    >
                      {order.id}
                    </Link>

                    {order.note && (
                      <button
                        type="button"
                        className="mt-1 block text-[10px] text-[#007F96] underline"
                      >
                        Note
                      </button>
                    )}

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
                      {order.status.map((item) => (
                        <StatusAction key={item.label} item={item} />
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-5 align-top">
                    <InvoiceBlock
                      invoice={order.invoice}
                      onCreateInvoice={() => setSelectedInvoiceOrder(order)}
                      onCreateXrayInvoice={() => setSelectedXrayOrder(order)}
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
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#64748B]">
            Showing {startRecord}-{endRecord} of {orders.length} orders
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
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
                    currentPage === page
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
              disabled={currentPage === totalPages}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
      />

      <CreateXrayInvoiceModal
        isOpen={Boolean(selectedXrayOrder)}
        order={selectedXrayOrder}
        onClose={() => setSelectedXrayOrder(null)}
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
        logs={orderActivityLogs}
        onClose={() => setSelectedLogOrder(null)}
      />
    </>
  );
}

function StatusAction({ item }) {
  const styles = {
    green: "text-[#059669]",
    red: "text-red-500",
    check: "text-[#059669]",
  };

  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-left text-[10px] font-semibold hover:underline ${
        styles[item.type] || "text-[#64748B]"
      }`}
    >
      {item.type === "check" ? (
        <span className="text-[10px]">✓</span>
      ) : (
        <span
          className={`h-[6px] w-[6px] rounded-full ${
            item.type === "red" ? "bg-red-500" : "bg-[#10B981]"
          }`}
        />
      )}

      {item.label}
    </button>
  );
}

function InvoiceBlock({
  invoice,
  onCreateInvoice,
  onCreateXrayInvoice,
  onCoverSheet,
  onXrayCoverSheet,
}) {
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
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[10px]">
      <p className="text-[#334155]">
        <button type="button" className="text-[#007F96] underline">
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

      {invoice.showXray && (
        <button
          type="button"
          onClick={onCreateXrayInvoice}
          className="block text-[#007F96] underline"
        >
          Create Xray Invoice
        </button>
      )}

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

function FormsList({ forms, onCnrClick }) {
  return (
    <div className="space-y-1">
      {forms.map((form) => {
        const isCnr = form === "CNR";

        return (
          <button
            key={form}
            type="button"
            onClick={isCnr ? onCnrClick : undefined}
            className="block text-left text-[10px] font-medium text-[#007F96] underline"
          >
            {form}
          </button>
        );
      })}
    </div>
  );
}