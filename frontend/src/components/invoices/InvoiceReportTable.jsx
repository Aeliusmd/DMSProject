"use client";

const invoiceGroups = [
  {
    company: "Smith & Associates",
    emails: "billing@smithassociates.com, accounts@smithassociates.com",
    rows: [
      {
        caseNo: "71956-4",
        sentDate: "03/18/2026",
        days: 74,
        invDate: "03/18/2026",
        invoiced: "$1,250.00",
        paid: "$400.00",
        due: "$850.00",
      },
      {
        caseNo: "71956-5",
        sentDate: "04/01/2026",
        days: 60,
        invDate: "04/01/2026",
        invoiced: "$850.00",
        paid: "$0.00",
        due: "$850.00",
      },
      {
        caseNo: "71956-6",
        sentDate: "04/15/2026",
        days: 46,
        invDate: "04/15/2026",
        invoiced: "$2,100.00",
        paid: "$1,200.00",
        due: "$900.00",
      },
      {
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
        caseNo: "72001-1",
        sentDate: "02/10/2026",
        days: 110,
        invDate: "02/10/2026",
        invoiced: "$3,200.00",
        paid: "$2,000.00",
        due: "$1,200.00",
      },
      {
        caseNo: "72001-2",
        sentDate: "03/25/2026",
        days: 67,
        invDate: "03/25/2026",
        invoiced: "$1,800.00",
        paid: "$500.00",
        due: "$1,300.00",
      },
      {
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
        caseNo: "72012-1",
        sentDate: "01/05/2026",
        days: 146,
        invDate: "01/05/2026",
        invoiced: "$2,750.00",
        paid: "$2,750.00",
        due: "$0.00",
      },
      {
        caseNo: "72012-2",
        sentDate: "03/10/2026",
        days: 82,
        invDate: "03/10/2026",
        invoiced: "$1,500.00",
        paid: "$0.00",
        due: "$1,500.00",
      },
      {
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
  return (
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
            {invoiceGroups.map((group) => (
              <InvoiceGroup key={group.company} group={group} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoiceGroup({ group }) {
  return (
    <>
      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <td className="px-4 py-4 align-top">
          <InvoiceCheckbox />
        </td>

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
        <InvoiceRow key={row.caseNo} row={row} />
      ))}

      <tr className="border-b border-[#CBD5E1] bg-white">
        <td className="px-4 py-4 align-middle">
          <InvoiceCheckbox />
        </td>

        <td colSpan={4} className="px-4 py-4 align-middle">
          <div className="flex min-w-max items-center gap-3">
            <span className="text-[12px] font-medium text-[#64748B]">All</span>

            <button
              type="button"
              className="h-[30px] whitespace-nowrap rounded-[6px] bg-[#EFF6FF] px-4 text-[11px] font-semibold text-[#94A3B8] hover:bg-[#E2E8F0]"
            >
              Send Invoice
            </button>

            <button
              type="button"
              className="h-[30px] whitespace-nowrap rounded-[6px] bg-[#EFF6FF] px-4 text-[11px] font-semibold text-[#94A3B8] hover:bg-[#E2E8F0]"
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

function InvoiceRow({ row }) {
  return (
    <tr className="border-b border-[#F1F5F9] bg-white hover:bg-[#F8FAFC]">
      <td className="px-4 py-4 align-top">
        <InvoiceCheckbox />
      </td>

      <td className="px-4 py-4"></td>
      <td className="px-4 py-4"></td>

      <td className="px-4 py-4 align-top">
        <div className="max-w-[190px] text-[12px] leading-[20px]">
          <span className="whitespace-nowrap font-semibold text-[#007F96]">
            {row.caseNo}
          </span>

          <span className="ml-2 text-[#94A3B8]">invoice sent</span>

          <span className="ml-1 whitespace-nowrap font-medium text-red-500">
            {row.sentDate}
          </span>

          <span className="ml-1 whitespace-nowrap text-[#64748B]">
            ({row.days} days)
          </span>
        </div>
      </td>

      <td className="px-4 py-4 align-top text-[12px] text-[#334155]">
        {row.invDate}
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
          className="h-[28px] whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
        >
          Writeoff
        </button>
      </td>
    </tr>
  );
}

function InvoiceCheckbox() {
  return (
    <input
      type="checkbox"
      className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
    />
  );
}