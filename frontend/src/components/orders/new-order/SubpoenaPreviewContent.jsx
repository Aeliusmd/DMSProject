"use client";

import { useEffect, useMemo, useState } from "react";

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;

const PDF_BASE_WIDTH = 520;
const PDF_BASE_HEIGHT = 760;

export default function SubpoenaPreviewContent({ file }) {
  const [fileUrl, setFileUrl] = useState("");
  const [pageCount, setPageCount] = useState(null);
  const [zoom, setZoom] = useState(1);

  const isPdf = useMemo(() => {
    if (!file) return false;

    const fileName = file.name?.toLowerCase() || "";
    const fileType = file.type || "";

    return fileType === "application/pdf" || fileName.endsWith(".pdf");
  }, [file]);

  useEffect(() => {
    if (!file) {
      setFileUrl("");
      setPageCount(null);
      setZoom(1);
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setFileUrl(objectUrl);
    setZoom(1);
    setPageCount(null);

    if (isPdf) {
      detectPdfPageCount(file).then((count) => {
        setPageCount(count);
      });
    }

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, isPdf]);

  const handleZoomIn = () => {
    setZoom((prev) => Number(Math.min(MAX_ZOOM, prev + ZOOM_STEP).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Number(Math.max(MIN_ZOOM, prev - ZOOM_STEP).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  if (!file) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-[8px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 text-center text-[12px] text-[#94A3B8]">
        Upload a subpoena PDF to preview it here.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3 rounded-[8px] bg-[#F8FAFC] px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] bg-[#DDF6FA] text-[#0097B2]">
            <PdfIcon />
          </span>

          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[#111827]">
              {file.name}
            </p>

            <p className="mt-[2px] text-[11px] text-[#94A3B8]">
              {pageCount ? `${pageCount} pages` : "PDF preview"} ·{" "}
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-[#64748B]">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom out"
          >
            <ZoomOutIcon />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="h-[28px] min-w-[46px] rounded-[6px] px-2 text-[11px] font-semibold text-[#334155] hover:bg-white"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom in"
          >
            <ZoomInIcon />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        {isPdf && fileUrl ? (
          <div
            className="mx-auto"
            style={{
              width: `${PDF_BASE_WIDTH * zoom}px`,
              height: `${PDF_BASE_HEIGHT * zoom}px`,
            }}
          >
            <iframe
              key={fileUrl}
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={file.name}
              className="origin-top-left rounded-[4px] border border-[#CBD5E1] bg-white shadow-sm"
              style={{
                width: `${PDF_BASE_WIDTH}px`,
                height: `${PDF_BASE_HEIGHT}px`,
                transform: `scale(${zoom})`,
              }}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-[8px] border border-dashed border-[#CBD5E1] bg-white px-4 text-center text-[12px] text-[#94A3B8]">
            Only PDF subpoenas can be previewed here.
          </div>
        )}
      </div>
    </div>
  );
}

async function detectPdfPageCount(file) {
  try {
    const fileName = file.name?.toLowerCase() || "";
    const fileType = file.type || "";

    if (fileType !== "application/pdf" && !fileName.endsWith(".pdf")) {
      return null;
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const matches = text.match(/\/Type\s*\/Page\b/g);

    return matches?.length || null;
  } catch {
    return null;
  }
}

function formatFileSize(size) {
  if (!size) return "0 KB";

  const mb = size / (1024 * 1024);

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l3 3v15H6V3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h4M9 16h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11h6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}