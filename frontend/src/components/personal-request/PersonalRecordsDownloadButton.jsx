"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import RecordsDownloadPanel, {
  extractRecordsDownloadToken,
} from "@/components/download/RecordsDownloadPanel";

export default function PersonalRecordsDownloadButton({
  downloadUrl,
  downloadToken,
  label = "Download",
  className = "",
}) {
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);

  const token =
    `${downloadToken || ""}`.trim() ||
    extractRecordsDownloadToken(downloadUrl);

  useEffect(() => {
    if (!open) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!token) return null;

  function openPopup(event) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
            <section
              className="w-full max-w-[380px] overflow-hidden rounded-[8px] bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="personal-records-download-title"
            >
              <div className="flex h-[50px] items-center justify-between border-b border-[#E2E8F0] px-5">
                <h2
                  id="personal-records-download-title"
                  className="text-[13px] font-semibold text-[#111827]"
                >
                  Download Records
                </h2>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
                  aria-label="Close download modal"
                >
                  ×
                </button>
              </div>

              <RecordsDownloadPanel token={token} variant="modal" onClose={() => setOpen(false)} />
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" onClick={openPopup} className={className}>
        {label}
      </button>
      {modal}
    </>
  );
}
