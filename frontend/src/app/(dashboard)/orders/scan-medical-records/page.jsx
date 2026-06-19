"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import {
  getOrder,
  uploadMedicalRecordsScan,
} from "@/lib/orders/orderApi";

export default function ScanMedicalRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const fileInputRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const hasMedicalRecords = Boolean(
    order?.medicalRecordsStoragePath || order?.medicalRecordsUrl
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (!orderId) {
        setLoadingOrder(false);
        setError("Order ID is required.");
        return;
      }

      setLoadingOrder(true);
      setError("");

      try {
        const data = await getOrder(orderId);
        if (!cancelled) {
          setOrder(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load order.");
        }
      } finally {
        if (!cancelled) {
          setLoadingOrder(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!loadingOrder && hasMedicalRecords) {
      router.replace("/orders");
    }
  }, [hasMedicalRecords, loadingOrder, router]);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const validateAndSetFile = (file) => {
    setError("");
    setSuccessMessage("");

    if (!file) return;

    if (file.type !== "application/pdf") {
      setSelectedFile(null);
      setError("Only PDF files are allowed.");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading || !orderId || hasMedicalRecords) return;

    setError("");
    setSuccessMessage("");
    setUploading(true);

    try {
      await uploadMedicalRecordsScan(orderId, selectedFile);
      setSuccessMessage(
        "Medical records uploaded. Upload Records workflow is complete."
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        router.push("/orders");
      }, 1200);
    } catch (err) {
      setError(err.message || "Medical records upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const applicantName = order
    ? [order.firstName, order.middleName, order.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  if (loadingOrder || hasMedicalRecords) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] items-center justify-center">
          <p className="text-[13px] text-[#64748B]">Loading...</p>
        </div>
      </DashboardShell>
    );
  }

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
            Scan Medical Records
          </h1>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[340px] text-center">
            <h2 className="text-[20px] font-semibold text-[#111827]">
              Scan Medical Records
            </h2>

            <p className="mt-2 text-[11px] text-[#94A3B8]">
              Upload scanned medical records PDF for this order (one time only)
            </p>

            {order ? (
              <div className="mt-6 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left text-[11px]">
                <p className="font-semibold text-[#111827]">
                  Order #{order.orderNumber}
                </p>
                {applicantName && (
                  <p className="mt-1 text-[#334155]">{applicantName}</p>
                )}
                {order.caseNumber && (
                  <p className="mt-1 text-[#64748B]">
                    Case: {order.caseNumber}
                  </p>
                )}
              </div>
            ) : null}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-8 flex h-[190px] w-full flex-col items-center justify-center rounded-[8px] border border-dashed transition ${
                isDragging
                  ? "border-[#0097B2] bg-[#E6F7FA]"
                  : "border-[#CBD5E1] bg-white"
              } ${!order ? "pointer-events-none opacity-50" : ""}`}
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
                disabled={uploading || !order}
                className="mt-5 inline-flex h-[30px] items-center justify-center rounded-[5px] bg-[#E6F7FA] px-4 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Choose File
              </button>

              <p className="mt-4 text-[10px] text-[#94A3B8]">PDF files only</p>

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
                disabled={uploading || !order}
                className="mt-4 inline-flex h-[34px] w-full items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#007F96] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload Medical Records"}
              </button>
            )}

            {successMessage && (
              <p className="mt-4 text-[11px] font-medium text-[#059669]">
                {successMessage}
              </p>
            )}

            {error && (
              <p className="mt-4 text-[11px] font-medium text-red-500">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
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
