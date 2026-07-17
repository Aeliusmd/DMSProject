"use client";

import { useParams } from "next/navigation";
import RecordsDownloadPanel from "@/components/download/RecordsDownloadPanel";

export default function DownloadRecordsPage() {
  const params = useParams();
  const token = `${params?.token || ""}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <RecordsDownloadPanel token={token} />
    </main>
  );
}
