"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function DownloadRecordsPage() {
  const params = useParams();
  const token = `${params?.token || ""}`;
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Preparing your download...");
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid download link.");
      return;
    }

    let cancelled = false;

    async function loadAndDownload() {
      try {
        const metaResponse = await fetch(
          `${API_BASE_URL}/public/records-download/${encodeURIComponent(token)}`
        );
        const metaBody = await metaResponse.json();

        if (!metaResponse.ok) {
          throw new Error(metaBody?.message || "Download link is invalid or expired.");
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
        const fileNameMatch = disposition.match(/filename="?([^"]+)"?/);
        const fileName = fileNameMatch?.[1] || `records-${data?.orderNumber || token}.zip`;

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
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <section className="w-full max-w-[480px] rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <h1 className="text-[18px] font-semibold text-[#111827]">
          Download Records
        </h1>

        {metadata ? (
          <p className="mt-2 text-[13px] text-[#64748B]">
            Order {metadata.orderNumber}
            {metadata.applicant ? ` • ${metadata.applicant}` : ""}
          </p>
        ) : null}

        <p
          className={`mt-5 text-[13px] ${
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

        {status === "success" ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 h-[36px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
          >
            Download again
          </button>
        ) : null}
      </section>
    </main>
  );
}
