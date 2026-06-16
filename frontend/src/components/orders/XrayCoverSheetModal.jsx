"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  SHEET_COLORS,
  SHEET_COMPANY_INFO,
  SHEET_DEFAULT_ADDRESS,
} from "@/lib/sheetTemplateConstants";

export default function XrayCoverSheetModal({ isOpen, order, onClose }) {
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

  const coverData = useMemo(() => {
    if (!order) return null;

    const orderId = order.id || order.orderNo || "N/A";
    const companyName = order.company?.name || order.provider || "N/A";
    const companyAddress = order.company?.address || "N/A";
    const dob = order.dobSsn?.[0] || "N/A";
    const yourFile = (order.orderRef || "N/A").replace("Ord #", "");

    const recordsRequested = [
      order.records?.title || "Medical Records",
      `Recs from ${companyName}`,
      order.applicant ? `Dr. ${getLastName(order.applicant)}` : "",
    ]
      .filter(Boolean)
      .join("; ");

    return {
      orderId,
      applicant: order.applicant || "N/A",
      dob,
      requestor: companyName,
      requestorAddress: companyAddress,
      yourFile,
      caseNumber: order.court || "N/A",
      locationCopied: companyName,
      deliveredTo: companyName,
      deliveredAddress: companyAddress,
      recordsRequested,
    };
  }, [order]);

  if (!mounted || !isOpen || !order || !coverData) return null;

  const handlePrint = () => {
    console.log("Print X-ray cover sheet:", coverData);
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-5">
          <h2 className="text-[13px] font-semibold text-[#111827]">
            X Ray Cover Sheet — {coverData.orderId}
          </h2>

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
              aria-label="Close x-ray cover sheet"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-7">
          <div className="mx-auto w-full max-w-[640px] bg-white text-[#111827]">
            <p className="text-center text-[11px] italic text-[#7E22CE]">
              &quot;{SHEET_COMPANY_INFO.tagline}&quot;
            </p>

            <div
              className="mt-1 h-px w-full"
              style={{ backgroundColor: SHEET_COLORS.lightPurple }}
            />

            <div className="mt-5 text-center">
              <h1 className="font-serif text-[30px] font-bold leading-none text-[#111827]">
                {SHEET_COMPANY_INFO.logoText}
              </h1>

              <p className="mt-4 text-[11px] text-[#475569]">
                {SHEET_COMPANY_INFO.companyName}
              </p>
            </div>

            <div className="mt-8 space-y-3 font-serif text-[13px] leading-[20px]">
              <CoverLine label="Applicant:" value={coverData.applicant} />
              <CoverLine label="DOB:" value={coverData.dob} />
              <CoverLine label="Requestor:" value={coverData.requestor} />

              <DefaultAddress className="ml-[66px] max-w-[360px]" />

              <CoverLine label="Your File #:" value={coverData.yourFile} />
              <CoverLine label="Case Number:" value={coverData.caseNumber} />

              <CoverLine
                label="Location Copied:"
                value={coverData.locationCopied}
              />

              <p className="ml-[96px] max-w-[390px] text-[#B45309]">
                {coverData.deliveredAddress}
              </p>

              <div className="pt-5">
                <CoverLine
                  label="Delivered To:"
                  value={coverData.deliveredTo}
                />

                <DefaultAddress className="ml-[78px] max-w-[360px]" />
              </div>

              <CoverLine
                label="Records Requested:"
                value={coverData.recordsRequested}
              />
            </div>

            <SheetFooter orderId={coverData.orderId} />
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function CoverLine({ label, value }) {
  return (
    <p>
      <span className="font-bold text-[#111827]">{label}</span>{" "}
      <span className="font-bold text-[#B45309]">{value}</span>
    </p>
  );
}

function DefaultAddress({ className = "" }) {
  return (
    <p className={`${className} text-[#B45309]`}>
      {SHEET_DEFAULT_ADDRESS.line1}
      <br />
      {SHEET_DEFAULT_ADDRESS.line2}
    </p>
  );
}

function SheetFooter({ orderId }) {
  return (
    <div className="mt-14 border-t border-[#E2E8F0] pt-4 text-center text-[10px] leading-[16px] text-[#64748B]">
      <p>{SHEET_COMPANY_INFO.addressLine1}</p>
      <p>{SHEET_COMPANY_INFO.cityStateZip}</p>
      <p className="text-[#007F96]">{SHEET_COMPANY_INFO.email}</p>
      <p>Reference # {orderId}</p>
    </div>
  );
}

function getLastName(name) {
  const parts = String(name).trim().split(" ");
  return parts[parts.length - 1] || name;
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