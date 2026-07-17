"use client";

export default function CompanyPortalQuickActions({
  onAction,
  isEmployee = false,
}) {
  const actions = [
    {
      id: "create-order",
      title: "Create order",
      description: "Start a new records request",
      accent: "#0097B2",
      bg: "#E6F7FA",
    },
    {
      id: "placed-orders",
      title: "Track order",
      description: "Look up status by order number",
      accent: "#2563EB",
      bg: "#EFF6FF",
    },
    {
      id: "edit-profile",
      title: "Profile",
      description: isEmployee
        ? "View your employee account details"
        : "View company account details",
      accent: "#059669",
      bg: "#ECFDF5",
    },
  ];

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[#111827]">Quick actions</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">
          {isEmployee
            ? "Common tasks for your employee account"
            : "Common tasks for your company account"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction?.(action.id)}
            className="rounded-[10px] border border-[#E2E8F0] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-sm"
            style={{ backgroundColor: action.bg }}
          >
            <p
              className="text-[14px] font-semibold"
              style={{ color: action.accent }}
            >
              {action.title}
            </p>
            <p className="mt-1 text-[12px] text-[#64748B]">
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
