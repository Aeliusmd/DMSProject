"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SubpoenaExtractionOverlay from "@/components/orders/new-order/SubpoenaExtractionOverlay";
import { uploadBatchScan } from "@/lib/orders/orderApi";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ERROR_FLASH_MS = 10000;

function isPdfFile(file) {
  if (!file) return false;
  const name = `${file.name || ""}`.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

export default function BatchScanPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(""), ERROR_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const rejectFile = (message) => {
    setSelectedFile(null);
    setUploading(false);
    clearFileInput();
    setError(message);
  };

  const handleChooseFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const validateAndSetFile = (file) => {
    if (!file) return;

    if (!isPdfFile(file)) {
      rejectFile("Only PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      // Do not keep or preview oversize PDFs.
      rejectFile(`File size must be less than ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (uploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;

    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    setError("");
    setUploading(true);

    try {
      const result = await uploadBatchScan(selectedFile);
      const created = result?.autoCreate?.created || [];
      const failed = result?.autoCreate?.failed || [];
      const createdCount = created.length;
      const failedCount = failed.length;
      const duplicateFailures = failed.filter(
        (item) =>
          item?.reason === "duplicate_order_number" ||
          /already exists|duplicate/i.test(`${item?.message || ""}`)
      );
      const otherFailures = failed.filter(
        (item) => !duplicateFailures.includes(item)
      );
      const duplicateNumbers = [
        ...new Set(
          duplicateFailures
            .map((item) => `${item?.orderNumber || ""}`.trim())
            .filter(Boolean)
        ),
      ];

      let message = `Batch scan complete. ${createdCount} order${
        createdCount === 1 ? "" : "s"
      } created.`;

      if (duplicateFailures.length > 0) {
        message += ` ${duplicateFailures.length} duplicate order${
          duplicateFailures.length === 1 ? "" : "s"
        } skipped`;
        if (duplicateNumbers.length) {
          message += ` (${duplicateNumbers.slice(0, 5).join(", ")}${
            duplicateNumbers.length > 5
              ? `, +${duplicateNumbers.length - 5} more`
              : ""
          })`;
        }
        message += " — order number already exists.";
      }

      if (otherFailures.length > 0) {
        const otherMessages = otherFailures
          .map((item) => item?.message)
          .filter(Boolean)
          .slice(0, 2);
        message += ` ${otherFailures.length} other create failure${
          otherFailures.length === 1 ? "" : "s"
        }`;
        if (otherMessages.length) {
          message += `: ${otherMessages.join("; ")}`;
        }
        message += ".";
      }

      try {
        window.sessionStorage.setItem(
          "dms.batchScanFlash",
          JSON.stringify({
            message,
            createdCount,
            failedCount,
            duplicateCount: duplicateFailures.length,
            at: Date.now(),
          })
        );
      } catch {
        // Ignore storage errors; still navigate to orders.
      }

      setSelectedFile(null);
      clearFileInput();

      router.push("/orders");
    } catch (err) {
      setError(err.message || "Batch scan upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col">
        <div className="shrink-0">
          <Link
            href="/orders"
            className="text-[11px] font-medium text-[#007F96] hover:underline"
          >
            Back to Orders
          </Link>
          <h1 className="mt-2 text-[15px] font-semibold text-[#111827]">
            BatchScan
          </h1>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[310px] text-center">
            <h2 className="text-[20px] font-semibold text-[#111827]">
              BatchScan
            </h2>

            <p className="mt-2 text-[11px] text-[#94A3B8]">
              Upload a scanned PDF with multiple subpoenas
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-8 flex h-[190px] w-full flex-col items-center justify-center rounded-[8px] border border-dashed transition ${
                isDragging
                  ? "border-[#0097B2] bg-[#E6F7FA]"
                  : "border-[#CBD5E1] bg-white"
              }`}
            >
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#F8FAFC] text-[#94A3B8]">
                <UploadCloudIcon />
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#111827]">
                Drag and drop your PDF here
              </p>

              <button
                type="button"
                onClick={handleChooseFile}
                disabled={uploading}
                className="mt-5 inline-flex h-[30px] items-center justify-center rounded-[5px] bg-[#E6F7FA] px-4 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Choose File
              </button>

              <p className="mt-4 text-[10px] text-[#94A3B8]">
                PDF files only, max {MAX_FILE_SIZE_MB}MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <p className="mt-4 truncate text-[11px] font-medium text-[#007F96]">
                Selected: {selectedFile.name}
              </p>
            )}

            {selectedFile && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="mt-4 inline-flex h-[34px] w-full items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#007F96] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload & Process"}
              </button>
            )}

            {error && (
              <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-3 text-left">
                <p className="text-[12px] font-semibold text-red-600">
                  {error}
                </p>
                {/50\s*MB/i.test(error) ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-red-500">
                    This PDF was not loaded. Choose a file smaller than{" "}
                    {MAX_FILE_SIZE_MB}MB.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubpoenaExtractionOverlay
        open={uploading}
        title="AI Processing Batch"
        description="Reading your batch PDF and extracting each subpoena. This may take a few minutes."
      />
    </DashboardShell>
  );
}

function UploadCloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15V7M8.5 10.5 12 7l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 18.5A4.5 4.5 0 0 1 7 9.52 5.5 5.5 0 0 1 17.58 11 3.75 3.75 0 0 1 17 18.5H6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
