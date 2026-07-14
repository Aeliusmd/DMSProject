"use client";

export default function CompanyPortalProfileCard({ user, onEdit }) {
  if (!user) return null;

  const address = [
    user.addressLine1,
    user.addressLine2,
    [user.city, user.state, user.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">
            Account details
          </h2>
          <p className="mt-1 text-[12px] text-[#64748B]">
            Your registered company profile
          </p>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="rounded-[6px] border border-[#D0E8ED] bg-[#E6F7FA] px-3 py-1.5 text-[12px] font-medium text-[#0B7C8E] hover:bg-[#D7F1F6]"
        >
          Edit profile
        </button>
      </div>

      <div className="space-y-3 text-[13px]">
        <DetailRow label="Company" value={user.companyName} />
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Phone" value={user.phone} />
        <DetailRow label="Address" value={address} />
      </div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#F8FAFC] pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#94A3B8]">
        {label}
      </span>
      <span className="font-medium text-[#111827] sm:text-right">
        {value || "—"}
      </span>
    </div>
  );
}
