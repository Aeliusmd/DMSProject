"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  getOrder,
  removeMedicalRecords,
  uploadMedicalRecordsScan,
} from "@/lib/orders/orderApi";
import {
  allOrderRecordSlotsUploaded,
  getOrderRecordSlots,
  getSavedOrderRecordTypeLabel,
} from "@/lib/orders/recordTypeUtils";

function resolveReturnPath(returnTo) {
  const normalized = `${returnTo || ""}`.trim().replace(/^\/+/, "");
  if (normalized === "company-orders") return "/company-orders";
  if (normalized === "personal-orders") return "/personal-orders";
  if (normalized === "reports") return "/reports";
  return "/orders";
}

export default function ScanMedicalRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const isEditMode = searchParams.get("mode") === "edit";
  const returnPath = resolveReturnPath(searchParams.get("returnTo"));

  const fileInputRefs = useRef({});
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [draggingType, setDraggingType] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removingType, setRemovingType] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const recordSlots = order ? getOrderRecordSlots(order) : [];
  const isMultiType = recordSlots.length > 1;
  const uploadedCount = recordSlots.filter((slot) => slot.hasFile).length;
  const allUploaded = order ? allOrderRecordSlotsUploaded(order) : false;
  const savedRecordTypeLabel = order ? getSavedOrderRecordTypeLabel(order) : "";
  const canUpload = recordSlots.length > 0;
  const backLabel =
    returnPath === "/company-orders"
      ? "Back to Company Orders"
      : returnPath === "/personal-orders"
        ? "Back to Personal Orders"
        : "Back to Orders";

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

  const isCnrOrder = Boolean(order?.certificateNoRecords);

  const MAX_FILE_SIZE_MB = 50;

  const clearSelectedFile = (recordType) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      delete next[recordType];
      return next;
    });
    const input = fileInputRefs.current[recordType];
    if (input) input.value = "";
  };

  const validateAndSetFiles = (recordType, fileList) => {
    setError("");
    setSuccessMessage("");

    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return false;

    for (const file of files) {
      if (file.type !== "application/pdf") {
        clearSelectedFile(recordType);
        setError("Only PDF files are allowed.");
        return false;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        clearSelectedFile(recordType);
        setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB.`);
        return false;
      }
    }

    setSelectedFiles((prev) => ({ ...prev, [recordType]: files }));
    return true;
  };

  const handleChooseFile = (recordType) => {
    fileInputRefs.current[recordType]?.click();
  };

  const handleFileChange = (recordType, event) => {
    validateAndSetFiles(recordType, event.target.files);
  };

  const handleDrop = (recordType, event) => {
    event.preventDefault();
    setDraggingType("");
    validateAndSetFiles(recordType, event.dataTransfer.files);
  };

  const refreshOrder = async () => {
    const data = await getOrder(orderId);
    setOrder(data);
    return data;
  };

  const selectedUploadSlots = recordSlots.filter((slot) => {
    const files = selectedFiles[slot.recordType];
    return Array.isArray(files) && files.length > 0;
  });

  const hasSelectedFiles = selectedUploadSlots.length > 0;

  const getUploadQueue = () => selectedUploadSlots;

  const handleUploadAll = async () => {
    const queue = getUploadQueue();
    if (!queue.length || uploading || !orderId) return;

    setError("");
    setSuccessMessage("");
    setUploading(true);

    const wasComplete = allOrderRecordSlotsUploaded(order);

    try {
      let latest = order;
      let uploadedFileCount = 0;

      for (const slot of queue) {
        const files = selectedFiles[slot.recordType] || [];
        if (!files.length) continue;

        latest = await uploadMedicalRecordsScan(orderId, files, {
          recordType: slot.recordType,
        });
        uploadedFileCount += files.length;

        if (latest) {
          setOrder(latest);
        } else {
          latest = await refreshOrder();
        }

        setSelectedFiles((prev) => {
          const next = { ...prev };
          delete next[slot.recordType];
          return next;
        });

        if (fileInputRefs.current[slot.recordType]) {
          fileInputRefs.current[slot.recordType].value = "";
        }
      }

      setConfirmAction(null);

      const uploadedLabels = queue.map((slot) => slot.label).join(", ");
      latest = latest || (await refreshOrder());
      const fileLabel =
        uploadedFileCount === 1 ? "file" : "files";

      if (
        allOrderRecordSlotsUploaded(latest) &&
        !wasComplete &&
        !isEditMode
      ) {
        setSuccessMessage(
          `${uploadedFileCount} ${fileLabel} uploaded for ${uploadedLabels}. All record types are complete.`
        );
        setTimeout(() => router.push(returnPath), 1500);
      } else {
        setSuccessMessage(
          `${uploadedFileCount} ${fileLabel} uploaded for ${uploadedLabels}.`
        );
      }
    } catch (err) {
      setError(err.message || "Records upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (recordType) => {
    if (!orderId || removingType) return;

    setError("");
    setSuccessMessage("");
    setRemovingType(recordType);

    try {
      const updated = await removeMedicalRecords(orderId, { recordType });
      if (updated) setOrder(updated);
      else await refreshOrder();
      setSuccessMessage("Scanned records removed.");
      setConfirmAction(null);
    } catch (err) {
      setError(err.message || "Failed to remove scanned records.");
    } finally {
      setRemovingType("");
    }
  };

  const applicantName = order
    ? [order.firstName, order.middleName, order.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  if (loadingOrder) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] items-center justify-center">
          <p className="text-[13px] text-[#64748B]">Loading...</p>
        </div>
      </DashboardShell>
    );
  }

  if (isCnrOrder) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-[14px] font-semibold text-[#111827]">
            Medical records cannot be uploaded
          </p>
          <p className="max-w-[420px] text-[13px] text-[#64748B]">
            This order is marked as Certificate of No Records (CNR). Use Send CNR
            Record from the orders table to email the CNR letter instead.
          </p>
          <Link
            href={returnPath}
            className="text-[12px] font-semibold text-[#007F96] hover:underline"
          >
            {backLabel}
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (isEditMode && !recordSlots.some((slot) => slot.hasFile)) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] flex-col items-center justify-center gap-3 px-4">
          <p className="text-[13px] text-[#64748B]">
            No scanned records are uploaded for this order.
          </p>
          <Link
            href={`/orders/scan-medical-records?orderId=${encodeURIComponent(
              orderId
            )}&returnTo=${encodeURIComponent(
              searchParams.get("returnTo") || "orders"
            )}`}
            className="text-[12px] font-semibold text-[#007F96] hover:underline"
          >
            Upload scanned records
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const pendingConfirmSlot = confirmAction?.type === "remove"
    ? recordSlots.find((slot) => slot.recordType === confirmAction.recordType)
    : null;

  const uploadQueue = confirmAction?.type === "upload" ? getUploadQueue() : [];
  const uploadedSlots = recordSlots.filter((slot) => slot.hasFile);

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col">
        <div className="shrink-0">
          <Link
            href={returnPath}
            className="text-[11px] font-medium text-[#007F96] hover:underline"
          >
            {backLabel}
          </Link>
          <h1 className="mt-2 text-[15px] font-semibold text-[#111827]">
            {isEditMode ? "Edit Scanned Records" : "Scan Records"}
          </h1>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 py-10">
          <div
            className={`w-full text-center ${
              isMultiType ? "max-w-[560px]" : "max-w-[340px]"
            }`}
          >
            <h2 className="text-[20px] font-semibold text-[#111827]">
              {isEditMode ? "Edit Scanned Records" : "Scan Records"}
            </h2>

            <p className="mt-2 text-[11px] text-[#94A3B8]">
              {isMultiType
                ? "Upload a PDF for each record type on this order."
                : isEditMode
                  ? "Upload a new PDF to replace the current file. Removal is optional."
                  : "Upload scanned records PDF for this order"}
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

                {canUpload && isMultiType && (
                  <div className="mt-3 space-y-2 border-t border-[#E2E8F0] pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {recordSlots.map((slot) => (
                        <span
                          key={slot.recordType}
                          className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-semibold ${
                            slot.hasFile
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              slot.hasFile ? "bg-[#22C55E]" : "bg-[#CBD5E1]"
                            }`}
                          />
                          {slot.label.replace(" Records", "")}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
                        <span
                          className="block h-full rounded-full bg-[#0097B2] transition-all"
                          style={{
                            width: `${recordSlots.length ? (uploadedCount / recordSlots.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-[#64748B]">
                        {uploadedCount}/{recordSlots.length}
                      </span>
                    </div>
                  </div>
                )}

                {uploadedSlots.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[#E2E8F0] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Uploaded documents
                    </p>
                    <ul className="space-y-1">
                      {uploadedSlots.map((slot) => (
                        <li
                          key={slot.recordType}
                          className="rounded-[4px] bg-white px-2 py-1.5 text-[10px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#166534]">
                              {slot.label}
                            </span>
                            <span className="text-[#64748B]">
                              {slot.files?.length || 1} PDF
                              {(slot.files?.length || 1) === 1 ? "" : "s"}
                            </span>
                          </div>
                          {(slot.files || []).length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-[#475569]">
                              {slot.files.map((file) => (
                                <li key={file.id || file.storagePath} className="truncate">
                                  {file.originalFileName || "records.pdf"}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {canUpload && !isMultiType ? (
                  <p className="mt-3 border-t border-[#E2E8F0] pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Record type
                    </span>
                    <span className="mt-1 block font-semibold text-[#111827]">
                      {savedRecordTypeLabel}
                    </span>
                  </p>
                ) : null}

                {!canUpload && (
                  <p className="mt-3 border-t border-[#E2E8F0] pt-3 text-[11px] font-medium text-amber-600">
                    No record types saved on this order. Set record types on
                    create or edit order first.
                  </p>
                )}
              </div>
            ) : null}

            {allUploaded && !isEditMode ? (
              <div className="mt-6 rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-left">
                <p className="text-[12px] font-semibold text-[#166534]">
                  All required records are uploaded
                </p>
                <p className="mt-1 text-[11px] text-[#15803D]">
                  Return to the orders table to email the records link when ready.
                </p>
                <Link
                  href={returnPath}
                  className="mt-3 inline-flex text-[11px] font-semibold text-[#007F96] underline"
                >
                  {backLabel}
                </Link>
              </div>
            ) : null}

            <div
              className={`mt-8 ${
                isMultiType ? "space-y-4" : "flex flex-col items-center"
              } ${!canUpload ? "opacity-50" : ""}`}
            >
              {recordSlots.map((slot) => {
                const selectedSlotFiles = selectedFiles[slot.recordType] || [];
                const isRemoving = removingType === slot.recordType;
                const isDragging = draggingType === slot.recordType;
                const uploadDisabled =
                  !canUpload || uploading || Boolean(removingType);
                const uploadedFileCount = slot.files?.length || 0;

                const uploadPanel = (
                  <>
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!uploadDisabled) {
                          setDraggingType(slot.recordType);
                        }
                      }}
                      onDragLeave={() => setDraggingType("")}
                      onDrop={(event) => {
                        if (!uploadDisabled) {
                          handleDrop(slot.recordType, event);
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-[8px] border border-dashed px-4 transition ${
                        isMultiType ? "mt-3 min-h-[96px]" : "min-h-[140px] w-full"
                      } ${
                        isDragging
                          ? "border-[#0097B2] bg-[#E6F7FA]"
                          : "border-[#CBD5E1] bg-[#F8FAFC]"
                      } ${uploadDisabled ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <p className="text-[11px] font-medium text-[#334155]">
                        Drop PDF files here
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                        Multiple PDFs allowed · Max {MAX_FILE_SIZE_MB}MB each
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#94A3B8]">or</p>
                      <button
                        type="button"
                        onClick={() => handleChooseFile(slot.recordType)}
                        disabled={uploadDisabled}
                        className="mt-2 inline-flex h-[26px] items-center justify-center rounded-[5px] border border-[#BAE6FD] bg-white px-3 text-[10px] font-semibold text-[#007F96] hover:bg-[#F0FBFD] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Browse
                      </button>
                      <input
                        ref={(node) => {
                          fileInputRefs.current[slot.recordType] = node;
                        }}
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        onChange={(event) =>
                          handleFileChange(slot.recordType, event)
                        }
                        className="hidden"
                      />
                    </div>

                    {selectedSlotFiles.length > 0 && (
                      <ul
                        className={`mt-2 space-y-0.5 text-[10px] font-medium text-[#007F96] ${
                          isMultiType ? "text-left" : "text-center"
                        }`}
                      >
                        {selectedSlotFiles.map((file) => (
                          <li key={file.name + file.size} className="truncate">
                            Selected: {file.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                );

                if (!isMultiType) {
                  return (
                    <div key={slot.recordType} className="w-full text-center">
                      {slot.hasFile && (
                        <div className="mb-3 flex items-center justify-between rounded-[6px] border border-[#E2E8F0] bg-white px-3 py-2 text-left">
                          <span className="text-[11px] font-medium text-[#059669]">
                            {uploadedFileCount} file
                            {uploadedFileCount === 1 ? "" : "s"} uploaded
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: "remove",
                                recordType: slot.recordType,
                              })
                            }
                            disabled={uploading || isRemoving}
                            className="text-[10px] font-medium text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRemoving ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      )}
                      {uploadPanel}
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.recordType}
                    className="rounded-[8px] border border-[#E2E8F0] bg-white p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-[#111827]">
                          {slot.label}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] font-medium ${
                            slot.hasFile ? "text-[#059669]" : "text-[#94A3B8]"
                          }`}
                        >
                          {slot.hasFile
                            ? `${uploadedFileCount} file${uploadedFileCount === 1 ? "" : "s"} uploaded`
                            : "Pending"}
                        </p>
                      </div>
                      {slot.hasFile ? (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              type: "remove",
                              recordType: slot.recordType,
                            })
                          }
                          disabled={uploading || isRemoving}
                          className="shrink-0 rounded-[4px] px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRemoving ? "..." : "Remove"}
                        </button>
                      ) : null}
                    </div>

                    {uploadPanel}
                  </div>
                );
              })}
            </div>

            {canUpload && (
              <button
                type="button"
                onClick={() => setConfirmAction({ type: "upload" })}
                disabled={!hasSelectedFiles || uploading || Boolean(removingType)}
                className="mt-6 inline-flex h-[34px] min-w-[140px] items-center justify-center rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#007F96] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
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

            {isMultiType && canUpload && (
              <p className="mt-4 text-[10px] text-[#64748B]">
                You can upload multiple PDFs per record type. Files are stored
                separately and are not merged.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmAction?.type === "upload"}
        title="Upload Records"
        message={
          uploadQueue.length > 1
            ? `Upload the selected PDFs for ${uploadQueue.map((slot) => slot.label).join(", ")}? Files will be saved separately and will not be merged.`
            : `Upload ${
                (selectedFiles[uploadQueue[0]?.recordType] || []).length || 1
              } PDF file${
                ((selectedFiles[uploadQueue[0]?.recordType] || []).length || 1) === 1
                  ? ""
                  : "s"
              } for ${uploadQueue[0]?.label || "records"}? Files will be saved separately and will not be merged.`
        }
        variant="warning"
        confirmLabel={uploading ? "Uploading..." : "Upload"}
        cancelLabel="Cancel"
        confirmDisabled={uploading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleUploadAll}
      />

      <ConfirmModal
        open={confirmAction?.type === "remove"}
        title={`Remove ${pendingConfirmSlot?.label || "Records"}`}
        message={`Remove all uploaded ${pendingConfirmSlot?.label || "records"} files for this order?`}
        variant="danger"
        confirmLabel={removingType ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        confirmDisabled={Boolean(removingType)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => handleRemove(confirmAction?.recordType)}
      />
    </DashboardShell>
  );
}
