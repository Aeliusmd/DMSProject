"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyInvoicePaymentPanel from "@/components/company-portal/CompanyInvoicePaymentPanel";
import { getOrderStatusStyles } from "@/lib/company-portal/companyPortalOrderStatus";
import {
  confirmCompanyPortalInvoicePayment,
  downloadBlobAsFile,
  fetchCompanyPortalReleasedDocumentsBlob,
  trackCompanyPortalOrder,
} from "@/lib/company-portal/companyPortalOrderApi";
import { isCompanyAuthenticated } from "@/lib/company-portal/companyPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function CompanyPortalTrackResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const orderNumber = decodeURIComponent(params?.orderNumber || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
      return;
    }

    let active = true;

    trackCompanyPortalOrder(orderNumber)
      .then((response) => {
        if (!active) return;
        setOrder(response?.data?.order || null);
      })
      .catch((err) => {
        if (active) {
          setError(getApiErrorMessage(err, "Unable to find that order"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const invoicePaid = searchParams.get("invoicePaid");

    if (!sessionId || invoicePaid !== "1" || !isCompanyAuthenticated()) {
      return;
    }

    let active = true;

    confirmCompanyPortalInvoicePayment(orderNumber, sessionId)
      .then((response) => {
        if (!active) return;
        setOrder(response?.data?.order || null);
        setInvoiceMessage("Invoice payment confirmed.");
        router.replace(`/company-portal/orders/track/${encodeURIComponent(orderNumber)}`);
      })
      .catch((err) => {
        if (active) {
          setInvoiceError(
            getApiErrorMessage(err, "Unable to confirm invoice payment")
          );
        }
      });

    return () => {
      active = false;
    };
  }, [orderNumber, router, searchParams]);

  const canDownload = Boolean(order?.canDownloadDocuments);
  const downloadExpired = Boolean(order?.downloadExpired);
  const downloadUnavailableReason = order?.downloadUnavailableReason || "";

  const handleDownload = async () => {
    if (!canDownload || !order?.id) return;
    setDownloadError("");
    setDownloading(true);
    try {
      const blob = await fetchCompanyPortalReleasedDocumentsBlob(order.id);
      downloadBlobAsFile(
        blob,
        `${order.orderNumber || "order"}-released-documents`
      );
    } catch (err) {
      setDownloadError(
        getApiErrorMessage(err, "Unable to download documents")
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <CompanyPortalDashboardShell title="Order Status">
      <div className="mb-4">
        <Link
          href="/company-portal/orders/track"
          className="text-[12px] font-medium text-[#0097B2] hover:underline"
        >
          ← Track another order
        </Link>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#64748B]">Looking up order...</p>
      ) : error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      ) : order ? (
        <div className="space-y-5">
          <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[12px] font-medium text-[#64748B]">
                  Order number
                </p>
                <h1 className="mt-1 text-[24px] font-semibold text-[#0097B2]">
                  {order.orderNumber}
                </h1>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${getOrderStatusStyles(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            </div>

            <p className="mt-4 text-[13px] text-[#64748B]">
              Current stage:{" "}
              <span className="font-semibold text-[#0F172A]">
                {order.status}
              </span>
              . Documents become available when status is Released.
            </p>

            {searchParams.get("canceled") === "1" ? (
              <p className="mt-4 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
                Card payment was canceled. You can try again below.
              </p>
            ) : null}

            {invoiceMessage ? (
              <p className="mt-4 rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[12px] text-[#047857]">
                {invoiceMessage}
              </p>
            ) : null}

            {invoiceError ? (
              <p className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {invoiceError}
              </p>
            ) : null}

            <CompanyInvoicePaymentPanel
              orderNumber={order.orderNumber}
              paymentLinks={order.paymentLinks}
              walletBalance={order.walletBalance}
              walletBalanceDisplay={order.walletBalanceDisplay}
              walletBalanceSource={order.walletBalanceSource}
              onOrderUpdated={setOrder}
            />

            <div className="mt-5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!canDownload || downloading}
                title={
                  canDownload
                    ? "Download released documents"
                    : downloadExpired
                      ? "Download expired after 7 days"
                      : "Available when records are released and within 7 days of email"
                }
                className={`inline-flex h-11 items-center justify-center rounded-[8px] px-5 text-[13px] font-semibold ${
                  canDownload
                    ? "bg-[#111827] text-white hover:bg-[#1F2937]"
                    : "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {downloading ? "Downloading..." : "Download Documents"}
              </button>
              {canDownload ? (
                <p className="mt-2 text-[12px] text-[#64748B]">
                  Download includes the released medical/other records for this
                  order. This download option expires 7 days after records are
                  emailed
                  {order.downloadExpiresAt
                    ? ` (available until ${new Date(
                        order.downloadExpiresAt
                      ).toLocaleDateString()})`
                    : ""}
                  .
                </p>
              ) : downloadExpired ? (
                <p className="mt-2 rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-[12px] text-[#9A3412]">
                  {downloadUnavailableReason ||
                    "Download records is not available because 7 days have passed since the records were sent."}
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[#64748B]">
                  {downloadUnavailableReason ||
                    "Download is disabled until this order reaches Released status and records are emailed."}
                </p>
              )}
              {downloadError ? (
                <p className="mt-2 text-[12px] text-red-600">{downloadError}</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-[#111827]">
              Order details
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Applicant" value={order.applicantName} />
              <Detail label="Facility" value={order.facilityName} />
              <Detail
                label="Facility address"
                value={order.facilityAddressDisplay || order.facilityAddress}
              />
              <Detail label="Treating doctor" value={order.treatingDoctor} />
              <Detail label="Case number" value={order.caseNumber} />
              <Detail label="Case name" value={order.caseName} />
              <Detail
                label="Records requested"
                value={order.recordTypesLabel || order.recordType}
              />
              <Detail label="Date requested" value={order.dateRequested} />
              <Detail label="Company" value={order.companyName} />
              <Detail
                label="Company address"
                value={order.companyAddressDisplay || order.companyAddress}
              />
              <Detail label="Contact email" value={order.contactEmail} />
              <Detail label="Contact phone" value={order.contactPhone} />
              <Detail
                label="Total paid"
                value={
                  order.paymentSummary?.totalPaidDisplay ||
                  order.paymentAmountDisplay ||
                  "—"
                }
              />
              <Detail
                label="Payment status"
                value={order.paymentStatus || "—"}
              />
              {Array.isArray(order.paymentSummary?.paymentLines) &&
              order.paymentSummary.paymentLines.length > 0 ? (
                <div className="sm:col-span-2 rounded-[8px] border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                    Payment breakdown
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {order.paymentSummary.paymentLines.map((line) => (
                      <li
                        key={`${line.label}-${line.amountDisplay}`}
                        className="flex items-center justify-between gap-3 text-[13px]"
                      >
                        <span className="text-[#475569]">{line.label}</span>
                        <span className="font-semibold text-[#0F172A]">
                          {line.amountDisplay}
                        </span>
                      </li>
                    ))}
                    <li className="mt-1 flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-2 text-[13px]">
                      <span className="font-semibold text-[#0F172A]">
                        Total paid
                      </span>
                      <span className="font-semibold text-[#0F172A]">
                        {order.paymentSummary.totalPaidDisplay}
                      </span>
                    </li>
                  </ul>
                  {Number(order.paymentSummary.outstandingDue) > 0 ? (
                    <p className="mt-2 text-[12px] text-[#B45309]">
                      Outstanding balance:{" "}
                      {order.paymentSummary.outstandingDueDisplay}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </CompanyPortalDashboardShell>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-[8px] border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-[#0F172A]">
        {value || "—"}
      </p>
    </div>
  );
}
