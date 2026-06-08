"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CNR_SIGNER,
  SHEET_COLORS,
  SHEET_COMPANY_INFO,
} from "@/lib/sheetTemplateConstants";

export default function CertificateNoRecordsModal({ isOpen, order, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const certificateData = useMemo(() => {
    if (!order) return null;

    return {
      orderId: order.id || order.orderNo || "N/A",
      date: "June 5, 2026",
      applicant: order.applicant || "N/A",
      reference: (order.orderRef || "N/A").replace("Ord #", ""),
      companyName: order.company?.name || "N/A",
      companyAddress: order.company?.address || "N/A",
      recordsRequested: [
        order.records?.title || "Medical Records",
        ...(order.records?.lines || []),
      ]
        .filter(Boolean)
        .join("; "),
    };
  }, [order]);

  if (!mounted || !isOpen || !order || !certificateData) return null;

  const handlePrint = () => {
    console.log("Print CNR:", certificateData);
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5">
          <div className="flex items-center gap-2">
            <span
              className="h-[8px] w-[8px] rounded-full"
              style={{ backgroundColor: SHEET_COLORS.purple }}
            />

            <h2 className="text-[13px] font-semibold text-[#111827]">
              Certificate of No Records — {certificateData.orderId}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[5px] bg-[#111827] px-3 text-[11px] font-semibold text-white hover:bg-[#1F2937]"
            >
              <PrintIcon />
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
              aria-label="Close CNR modal"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="h-[3px] shrink-0"
          style={{ backgroundColor: SHEET_COLORS.purple }}
        />

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-7">
          <div className="mx-auto w-full max-w-[610px] bg-white font-serif text-[#111827]">
            <p className="text-center text-[11px] italic text-[#6B7280]">
              &quot;{SHEET_COMPANY_INFO.tagline}&quot;
            </p>

            <div className="mt-5 flex justify-center">
              <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-[#111827] text-[20px] font-bold">
                {SHEET_COMPANY_INFO.logoText}
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[12px] font-bold">
                {SHEET_COMPANY_INFO.companyName}
              </p>

              <p className="mt-1 text-[10px] text-[#64748B]">
                {SHEET_COMPANY_INFO.addressLine1}
              </p>

              <p className="text-[10px] text-[#64748B]">
                {SHEET_COMPANY_INFO.cityStateZip}
              </p>

              <p className="text-[10px] text-[#007F96]">
                {SHEET_COMPANY_INFO.email}
              </p>
            </div>

            <h1 className="mt-6 text-center text-[16px] font-bold">
              Certificate of No Records
            </h1>

            <div className="mt-7 space-y-4 text-[13px] leading-[21px]">
              <p>{certificateData.date}</p>

              <div>
                <p>{certificateData.companyName}</p>
                <p className="font-bold">{certificateData.companyName}</p>
                <p>{certificateData.companyAddress}</p>
                <p className="font-bold">New Lebanon, OH 45345</p>
              </div>

              <div className="space-y-1">
                <p>
                  <span className="ml-8 font-bold">Regarding:</span>{" "}
                  <span className="text-[#B45309]">
                    {certificateData.applicant}
                  </span>
                </p>

                <p>
                  <span className="ml-8 font-bold">Reference #</span>{" "}
                  <span className="text-[#B45309]">
                    {certificateData.reference}
                  </span>
                </p>
              </div>

              <p>
                I understand, being the{" "}
                <span className="text-[#B45309]">
                  authorized Release of Information
                </span>{" "}
                for:
              </p>

              <p>Declare the following:</p>

              <p>
                We certify that a thorough search of our files, carried out
                under{" "}
                <span className="text-[#B45309]">
                  our direction and control
                </span>{" "}
                revealed no records on the patient named in the{" "}
                <span className="text-[#B45309]">Subpoena / Authorization</span>{" "}
                for the above named{" "}
                <span className="text-[#B45309]">
                  medical facility / doctor.
                </span>
              </p>

              <p className="pt-8 text-[#B45309]">
                I declare under penalty of perjury, under the law of the State
                of California, that the foregoing is true and correct.
              </p>

              <div className="pt-7">
                <p className="font-bold">{CNR_SIGNER.name}</p>
                <p className="underline">{CNR_SIGNER.title}</p>
                <p>{SHEET_COMPANY_INFO.companyName}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function PrintIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 14h10v7H7v-7Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}