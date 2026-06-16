"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import {
  downloadFacilityDocument,
  getFacilityDocumentPreviewBlob,
} from "@/lib/facilities/facilityApi";

const PREVIEWABLE_TYPES = new Set(["PDF", "JPG", "JPEG", "PNG", "GIF", "WEBP"]);

export default function DocumentPreviewModal({
  open,
  facilityId,
  selectedDocument,
  onClose,
}) {
  const mounted = useIsClient();
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const canPreview = PREVIEWABLE_TYPES.has(
    String(selectedDocument?.fileType || "").toUpperCase()
  );

  useEffect(() => {
    if (!open || !selectedDocument || !facilityId) return;

    let active = true;
    let objectUrl = "";

    const loadPreview = async () => {
      if (!canPreview) return;

      setLoading(true);
      setError("");

      try {
        const blob = await getFacilityDocumentPreviewBlob(
          facilityId,
          selectedDocument.id
        );

        if (!active) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load document preview");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, selectedDocument, facilityId, canPreview]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      setError("");
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open || !selectedDocument) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError("");

    try {
      await downloadFacilityDocument(
        facilityId,
        selectedDocument.id,
        selectedDocument.documentName || selectedDocument.name
      );
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloading(false);
    }
  };

  const fileType = String(selectedDocument.fileType || "").toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#E2E8F0] px-5">
          <div className="min-w-0 pr-4">
            <h2 className="truncate text-[13px] font-semibold text-[#111827]">
              {selectedDocument.documentName || selectedDocument.name}
            </h2>
            <p className="text-[10px] text-[#64748B]">
              {selectedDocument.documentType} · {fileType}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex h-[32px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              <DownloadIcon />
              {downloading ? "Downloading..." : "Download"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-[320px] flex-1 overflow-auto bg-[#F8FAFC] p-4">
          {error && (
            <div className="mb-3 rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex h-[360px] items-center justify-center text-[13px] text-[#64748B]">
              Loading preview...
            </div>
          )}

          {!loading && canPreview && previewUrl && fileType === "PDF" && (
            <iframe
              title={selectedDocument.documentName || selectedDocument.name}
              src={previewUrl}
              className="h-[70vh] w-full rounded-[6px] border border-[#E2E8F0] bg-white"
            />
          )}

          {!loading && canPreview && previewUrl && fileType !== "PDF" && (
            <div className="flex min-h-[360px] items-center justify-center">
              <img
                src={previewUrl}
                alt={selectedDocument.documentName || selectedDocument.name}
                className="max-h-[70vh] max-w-full rounded-[6px] border border-[#E2E8F0] bg-white object-contain"
              />
            </div>
          )}

          {!loading && !canPreview && (
            <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-[13px] text-[#64748B]">
                Preview is not available for this file type.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex h-[34px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:opacity-60"
              >
                Download File
              </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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
