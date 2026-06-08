import StatCard from "@/components/dashboard/StatCard";

export default function OrderStatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        layout="horizontal"
        icon={<TotalIcon />}
        value="12"
        label="Total Orders"
        iconBg="#111827"
        iconColor="#FFFFFF"
      />

      <StatCard
        layout="horizontal"
        icon={<ActiveIcon />}
        value="3"
        label="Active Cases"
        iconBg="#10B981"
        iconColor="#FFFFFF"
      />

      <StatCard
        layout="horizontal"
        icon={<ReadyIcon />}
        value="2"
        label="Ready to Pickup"
        iconBg="#0097B2"
        iconColor="#FFFFFF"
      />

      <StatCard
        layout="horizontal"
        icon={<CompletedIcon />}
        value="1"
        label="Completed"
        iconBg="#475569"
        iconColor="#FFFFFF"
      />
    </div>
  );
}

function TotalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h12v16H6V4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M5 7h14v12H5V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReadyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="m7 12 3 3 7-7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CompletedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}