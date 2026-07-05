"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import SheetLetterhead from "@/components/orders/SheetLetterhead";
import { buildCertificateFormData } from "@/lib/orders/certificateFormData";
import {
  CERTIFICATE_SIGNER,
  SHEET_COLORS,
  SHEET_COMPANY_INFO,
} from "@/lib/sheetTemplateConstants";

export default function CertificateOfRecordsModal({
  isOpen,
  order,
  onClose,
  onSendEmail,
}) {
  const mounted = useIsClient();

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const certificateData = useMemo(() => buildCertificateFormData(order), [order]);

  if (!mounted || !isOpen || !order || !certificateData) return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 px-4 py-6 backdrop-blur-[2px] print:static print:bg-white print:p-0">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl print:max-h-none print:max-w-none print:shadow-none">
        <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 print:hidden">
          <div className="flex items-center gap-2">
            <span
              className="h-[8px] w-[8px] rounded-full"
              style={{ backgroundColor: SHEET_COLORS.purple }}
            />
            <h2 className="text-[13px] font-semibold text-[#111827]">
              Certificate of Records — {certificateData.orderId}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSendEmail}
              className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[5px] bg-[#111827] px-3 text-[11px] font-semibold text-white hover:bg-[#1F2937]"
            >
              <EmailIcon />
              Send Email
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[5px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#111827] hover:bg-[#F8FAFC]"
            >
              <PrintIcon />
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
              aria-label="Close certification modal"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="h-[3px] shrink-0 print:hidden"
          style={{ backgroundColor: SHEET_COLORS.purple }}
        />

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-7 print:overflow-visible">
          <div className="certificate-sheet mx-auto w-full max-w-[610px] bg-white font-serif text-[#111827]">
            <SheetLetterhead />

            <h1 className="mt-6 text-center text-[16px] font-bold">
              Certificate of Records
            </h1>

            <div className="mt-7 space-y-4 text-[13px] leading-[21px]">
              <p>{certificateData.date}</p>

              <div>
                <p className="font-bold">{certificateData.companyName}</p>
                {certificateData.companyAddressLines.map((line) => (
                  <p key={line} className="font-bold">
                    {line}
                  </p>
                ))}
              </div>

              <div className="space-y-1">
                <p>
                  <span className="ml-8 font-bold">Regarding:</span>{" "}
                  <span className="text-[#B45309]">{certificateData.applicant}</span>
                </p>
                <p>
                  <span className="ml-8 font-bold">Reference #</span>{" "}
                  <span className="text-[#B45309]">{certificateData.reference}</span>
                </p>
              </div>

              <p>
                I, the undersigned, being the authorized Release of Information service
                for,{" "}
                <span className="font-bold text-[#B45309]">
                  {certificateData.facilityName}
                </span>
                {certificateData.facilityAddressLines.length > 0 ? (
                  <>
                    {", "}
                    <span className="text-[#B45309]">
                      {certificateData.facilityAddressLines.join(", ")}
                    </span>
                  </>
                ) : null}
                .
              </p>

              <p>Declare the following:</p>

              <p>
                Including this declaration, all records requested have been reproduced in
                my presence, under my direction and control. The copy submitted with the
                declaration is a true copy thereof.
              </p>

              <p>
                To the best of my knowledge all records referred to above, were prepared
                or complied by our personnel, in the ordinary course of business at or
                near the time of the acts, conditions, or events recorded.
              </p>

              <p className="text-[#B45309]">
                I declare under penalty of perjury, under the law of the State of
                California, that the foregoing is true and correct.
              </p>

              <div className="pt-7">
                <p className="font-bold">{CERTIFICATE_SIGNER.name}</p>
                <p className="underline">{CERTIFICATE_SIGNER.title}</p>
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

function EmailIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16v12H4V6Zm0 0 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
