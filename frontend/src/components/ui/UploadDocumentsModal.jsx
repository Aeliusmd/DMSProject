"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";

export const DOCUMENT_TYPES = [
  "Standard",
  "Legal",
  "Medical",
  "Financial",
  "Other",
];

export default function UploadDocumentsModal({
  open,
  title = "Upload Documents",
  onClose,
  onUpload,
  uploading = false,
  uploadError = "",
}) {
  const mounted = useIsClient();
  const [documentType, setDocumentType] = useState("Standard");
  const [files, setFiles] = useState([]);
  const [localError, setLocalError] = useState("");
  const openSession = open ? "open" : null;
  const [prevOpenSession, setPrevOpenSession] = useState(null);

  if (openSession !== prevOpenSession) {
    setPrevOpenSession(openSession);

    if (openSession) {
      setDocumentType("Standard");
      setFiles([]);
      setLocalError("");
    }
  }

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setLocalError("");
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setLocalError("Please select a file to upload");
      return;
    }

    setLocalError("");

    try {
      await onUpload?.({
        documentType,
        files,
      });
    } catch {
      // Parent handles and passes uploadError.
    }
  };

  const displayError = localError || uploadError;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[380px] overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[50px] items-center justify-between border-b border-[#E2E8F0] px-5">
          <h2 className="text-[13px] font-semibold text-[#111827]">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] disabled:opacity-60"
            aria-label="Close upload modal"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
              Document Type
            </label>

            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              disabled={uploading}
              className="h-[34px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:opacity-60"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
              File
            </label>

            <input
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-[11px] text-[#64748B] file:mr-3 file:h-[30px] file:rounded-[5px] file:border file:border-[#E2E8F0] file:bg-[#F8FAFC] file:px-3 file:text-[11px] file:font-medium file:text-[#334155] hover:file:bg-[#F1F5F9] disabled:opacity-60"
            />

            {files.length > 0 && (
              <p className="mt-2 text-[10px] text-[#64748B]">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {displayError && (
            <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
              {displayError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="inline-flex h-[32px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[11px] font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex h-[32px] items-center justify-center gap-2 rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UploadIcon />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function UploadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 16V5M8 9l4-4 4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
