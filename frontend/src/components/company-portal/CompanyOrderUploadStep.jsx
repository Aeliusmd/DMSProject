"use client";

import { useRef, useState } from "react";
import { formatFileSize } from "@/lib/company-portal/companyPortalOrderUtils";

export default function CompanyOrderUploadStep({
  fileMeta,
  previewUrl,
  extracting,
  error,
  onFileSelected,
  onRemoveFile,
  onProcess,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    onFileSelected?.(file);
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#E6F7FA] text-[#0097B2]">
          <CloudUploadIcon />
        </div>
        <h2 className="text-[22px] font-semibold text-[#0F172A]">
          Upload Your Subpoena
        </h2>
        <p className="mx-auto mt-2 max-w-[460px] text-[13px] leading-relaxed text-[#64748B]">
          Upload the subpoena document in PDF format. Our system will
          automatically extract key information to speed up processing.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-[12px] border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-[#0097B2] bg-[#F0FBFD]"
            : "border-[#CBD5E1] bg-[#F8FAFC]"
        }`}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[10px] bg-white text-[#94A3B8] shadow-sm">
          <PdfIcon />
        </div>
        <p className="text-[14px] font-medium text-[#334155]">
          Drag and drop your subpoena PDF here or
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex h-10 items-center rounded-[8px] bg-[#0097B2] px-5 text-[13px] font-medium text-white hover:bg-[#0086A0]"
        >
          Choose File
        </button>
        <p className="mt-3 text-[12px] text-[#94A3B8]">
          PDF files only, up to 50MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {fileMeta ? (
        <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#FEE2E2] text-[#DC2626]">
            <PdfIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#0F172A]">
              {fileMeta.name}
            </p>
            <p className="text-[12px] text-[#64748B]">
              {formatFileSize(fileMeta.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemoveFile}
            className="rounded-[6px] px-2 py-1 text-[16px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#64748B]"
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-[10px] border border-[#E2E8F0]">
          <iframe
            title="Subpoena preview"
            src={previewUrl}
            className="h-[320px] w-full bg-[#F8FAFC]"
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!fileMeta || extracting}
        onClick={onProcess}
        className={`mt-6 flex h-11 w-full items-center justify-center rounded-[8px] text-[14px] font-semibold text-white transition ${
          !fileMeta || extracting
            ? "cursor-not-allowed bg-[#0097B2]/45"
            : "bg-[#0097B2] hover:bg-[#0086A0]"
        }`}
      >
        {extracting ? "Processing Document..." : "Process Document"}
      </button>
    </div>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18h10a4 4 0 0 0 .3-8 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14V8m0 0 2.5 2.5M12 8 9.5 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
