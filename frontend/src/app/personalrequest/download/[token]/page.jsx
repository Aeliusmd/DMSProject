"use client";

import { useParams } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import RecordsDownloadPanel from "@/components/download/RecordsDownloadPanel";

export default function PersonalRequestDownloadPage() {
  const params = useParams();
  const token = `${params?.token || ""}`;

  return (
    <PersonalPortalDashboardShell title="Download Records">
      <div className="flex justify-center py-6">
        <RecordsDownloadPanel token={token} />
      </div>
    </PersonalPortalDashboardShell>
  );
}
