"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import UnprocessedSubpoenaCard from "@/components/orders/unprocessed/UnprocessedSubpoenaCard";
import PdfPreviewDrawer from "@/components/orders/unprocessed/PdfPreviewDrawer";

const subpoenas = [
  {
    id: "SUB-001",
    fileName: "not_custodian_5.22.26_11.pdf",
    uploadedAt: "05/22/26 1:30 AM",
    pages: 11,
    size: "2.4 MB",
  },
  {
    id: "SUB-002",
    fileName: "medical_records_subpoena_5.20.26.pdf",
    uploadedAt: "05/20/26 8:15 PM",
    pages: 7,
    size: "1.9 MB",
  },
  {
    id: "SUB-003",
    fileName: "billing_subpoena_johnson_v_state_5.18.26.pdf",
    uploadedAt: "05/18/26 9:45 AM",
    pages: 15,
    size: "3.1 MB",
  },
  {
    id: "SUB-004",
    fileName: "employment_verification_subpoena_5.17.26.pdf",
    uploadedAt: "05/17/26 6:04 PM",
    pages: 5,
    size: "1.2 MB",
  },
  {
    id: "SUB-005",
    fileName: "xray_imaging_subpoena_5.16.26.pdf",
    uploadedAt: "05/16/26 11:20 AM",
    pages: 22,
    size: "4.7 MB",
  },
  {
    id: "SUB-006",
    fileName: "custodian_records_smith_case_5.15.26.pdf",
    uploadedAt: "05/15/26 4:35 PM",
    pages: 13,
    size: "2.9 MB",
  },
  {
    id: "SUB-007",
    fileName: "hospital_records_request_5.14.26.pdf",
    uploadedAt: "05/14/26 2:10 PM",
    pages: 9,
    size: "2.1 MB",
  },
];

export default function UnprocessedSubpoenasPage() {
  const [selectedSubpoena, setSelectedSubpoena] = useState(null);

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-[#111827]">
              Unprocessed Subpoenas
            </h1>
            <p className="mt-[4px] text-[13px] text-[#64748B]">
              Uploaded subpoenas not yet linked to an order
            </p>
          </div>

          <p className="text-[12px] font-medium text-[#94A3B8] sm:mt-[6px]">
            {subpoenas.length} subpoenas
          </p>
        </div>

        <section className="flex min-h-[520px] flex-1 overflow-hidden rounded-[9px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {subpoenas.map((subpoena) => (
              <UnprocessedSubpoenaCard
                key={subpoena.id}
                subpoena={subpoena}
                isSelected={selectedSubpoena?.id === subpoena.id}
                onPreview={() => setSelectedSubpoena(subpoena)}
              />
            ))}
          </div>
        </section>
      </div>

      <PdfPreviewDrawer
        subpoena={selectedSubpoena}
        onClose={() => setSelectedSubpoena(null)}
      />
    </DashboardShell>
  );
}