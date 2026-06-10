"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const uploadTypes = ["Standard", "Legal", "Medical", "Financial", "Other"];

export default function UploadDocumentsModal({
  open,
  title = "Upload Documents",
  onClose,
  onUpload,
}) {
  const [mounted, setMounted] = useState(false);
  const [uploadType, setUploadType] = useState("Standard");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setUploadType("Standard");
    setFiles([]);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleUpload = () => {
    const uploadData = {
      uploadType,
      files,
    };

    console.log("Upload documents:", uploadData);
    onUpload?.(uploadData);
    onClose?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[380px] overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[50px] items-center justify-between border-b border-[#E2E8F0] px-5">
          <h2 className="text-[13px] font-semibold text-[#111827]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
            aria-label="Close upload modal"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
              Upload Type
            </label>

            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="h-[34px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            >
              {uploadTypes.map((type) => (
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
              className="block w-full text-[11px] text-[#64748B] file:mr-3 file:h-[30px] file:rounded-[5px] file:border file:border-[#E2E8F0] file:bg-[#F8FAFC] file:px-3 file:text-[11px] file:font-medium file:text-[#334155] hover:file:bg-[#F1F5F9]"
            />

            {files.length > 0 && (
              <p className="mt-2 text-[10px] text-[#64748B]">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[32px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[11px] font-semibold text-[#475569] hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUpload}
            className="inline-flex h-[32px] items-center justify-center gap-2 rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
          >
            <UploadIcon />
            Upload
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