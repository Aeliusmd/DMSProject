"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/api";

function formatExpiry(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function extractRecordsDownloadToken(downloadUrlOrToken) {
  const value = `${downloadUrlOrToken || ""}`.trim();
  if (!value) return "";

  if (!value.includes("/") && !value.includes("?")) {
    return value;
  }

  try {
    const url = new URL(value, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const downloadIndex = parts.findIndex((part) => part === "download");
    if (downloadIndex >= 0 && parts[downloadIndex + 1]) {
      if (parts[downloadIndex - 1] === "personalrequest") {
        return parts[downloadIndex + 1];
      }
      if (parts[downloadIndex + 1] === "records" && parts[downloadIndex + 2]) {
        return parts[downloadIndex + 2];
      }
    }
    return parts[parts.length - 1] || "";
  } catch {
    return value.split("/").filter(Boolean).pop() || "";
  }
}

export default function RecordsDownloadPanel({
  token,
  attempt = 0,
  showTitle = true,
  className = "",
  variant = "page",
  onClose,
}) {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Preparing your download...");
  const [metadata, setMetadata] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const isModal = variant === "modal";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid download link.");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setMessage("Preparing your download...");
    setMetadata(null);

    async function loadAndDownload() {
      try {
        const metaResponse = await fetch(
          `${API_BASE_URL}/public/records-download/${encodeURIComponent(token)}`
        );
        const metaBody = await metaResponse.json();

        if (!metaResponse.ok) {
          throw new Error(
            metaBody?.message || "Download link is invalid or expired."
          );
        }

        const data = metaBody?.data || null;
        if (!cancelled) {
          setMetadata(data);
        }

        const fileResponse = await fetch(
          `${API_BASE_URL}/public/records-download/${encodeURIComponent(token)}/file`
        );

        if (!fileResponse.ok) {
          let errorMessage = "Failed to download records.";
          try {
            const errorBody = await fileResponse.json();
            errorMessage = errorBody?.message || errorMessage;
          } catch {
            // ignore non-JSON error bodies
          }
          throw new Error(errorMessage);
        }

        const blob = await fileResponse.blob();
        const disposition = fileResponse.headers.get("Content-Disposition") || "";
        const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
        const contentType = fileResponse.headers.get("Content-Type") || "";
        const files = data?.files || [];
        const defaultExt =
          files.length === 1 || contentType.includes("pdf") ? "pdf" : "zip";
        const fileName =
          fileNameMatch?.[1] ||
          (files.length === 1 && files[0]?.filename) ||
          `records-${data?.orderNumber || token}.${defaultExt}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);

        if (!cancelled) {
          setStatus("success");
          setMessage("Your download has started.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error.message || "Unable to download records.");
        }
      }
    }

    loadAndDownload();

    return () => {
      cancelled = true;
    };
  }, [token, attempt, retryCount]);

  if (isModal) {
    return (
      <>
        <div className="space-y-3 px-5 py-4">
          {metadata ? (
            <p className="text-[12px] text-[#64748B]">
              Order {metadata.orderNumber}
              {metadata.applicant ? ` • ${metadata.applicant}` : ""}
            </p>
          ) : null}

          {status === "error" ? (
            <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
              {message}
            </div>
          ) : (
            <p className="text-[12px] leading-[20px] text-[#475569]">{message}</p>
          )}

          {metadata?.expiresAt ? (
            <p className="text-[11px] text-[#94A3B8]">
              Link expires on {formatExpiry(metadata.expiresAt)}.
            </p>
          ) : null}

          {status === "success" && metadata?.files?.length ? (
            <div className="rounded-[7px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                Included records
              </p>
              <ul className="mt-1.5 space-y-1">
                {metadata.files.map((file) => (
                  <li
                    key={file.recordType}
                    className="text-[11px] text-[#334155]"
                  >
                    {file.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[32px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[11px] font-semibold text-[#475569] hover:bg-[#F8FAFC]"
          >
            Close
          </button>

          {status === "success" || status === "error" ? (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
            >
              {status === "error" ? "Try again" : "Download again"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Preparing...
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <section
      className={`w-full max-w-[480px] rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm ${className}`}
    >
      {showTitle ? (
        <h1 className="text-[18px] font-semibold text-[#111827]">
          Download Records
        </h1>
      ) : null}

      {metadata ? (
        <p className={`text-[13px] text-[#64748B] ${showTitle ? "mt-2" : ""}`}>
          Order {metadata.orderNumber}
          {metadata.applicant ? ` • ${metadata.applicant}` : ""}
        </p>
      ) : null}

      <p
        className={`text-[13px] ${showTitle || metadata ? "mt-5" : ""} ${
          status === "error" ? "text-red-500" : "text-[#334155]"
        }`}
      >
        {message}
      </p>

      {metadata?.expiresAt ? (
        <p className="mt-3 text-[12px] text-[#94A3B8]">
          Link expires on {formatExpiry(metadata.expiresAt)}.
        </p>
      ) : null}

      {status === "success" && metadata?.files?.length ? (
        <div className="mt-5 rounded-[8px] bg-[#F8FAFC] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Included records
          </p>
          <ul className="mt-2 space-y-1">
            {metadata.files.map((file) => (
              <li key={file.recordType} className="text-[12px] text-[#334155]">
                {file.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status === "success" || status === "error" ? (
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-6 h-[36px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
        >
          {status === "error" ? "Try again" : "Download again"}
        </button>
      ) : null}
    </section>
  );
}
