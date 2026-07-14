"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyOrderStepper from "@/components/company-portal/CompanyOrderStepper";
import CompanyOrderCompleteStep from "@/components/company-portal/CompanyOrderCompleteStep";
import {
  clearCompanyOrderWizardState,
  confirmCompanyPortalPayment,
  downloadBlobAsFile,
  fetchCompanyPortalPaymentReceiptBlob,
  fetchCompanyPortalSubpoenaBlob,
} from "@/lib/company-portal/companyPortalOrderApi";
import { isCompanyAuthenticated } from "@/lib/company-portal/companyPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

function CompanyOrderCompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [downloadingSubpoena, setDownloadingSubpoena] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
      return;
    }

    let active = true;
    const sessionId = searchParams.get("session_id");

    confirmCompanyPortalPayment(sessionId)
      .then((response) => {
        if (!active) return;
        setOrder(response?.data?.order || null);
        clearCompanyOrderWizardState();
      })
      .catch((err) => {
        if (active) {
          setError(getApiErrorMessage(err, "Unable to confirm payment"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  const handleDownloadSubpoena = async () => {
    if (!order?.id) return;
    setDownloadError("");
    setDownloadingSubpoena(true);
    try {
      const blob = await fetchCompanyPortalSubpoenaBlob(order.id);
      downloadBlobAsFile(blob, order.subpoenaFileName || "subpoena.pdf");
    } catch (err) {
      setDownloadError(
        getApiErrorMessage(err, "Unable to download subpoena file")
      );
    } finally {
      setDownloadingSubpoena(false);
    }
  };

  const handleDownloadPaymentReceipt = async () => {
    if (!order?.id) return;
    setDownloadError("");
    setDownloadingReceipt(true);
    try {
      const blob = await fetchCompanyPortalPaymentReceiptBlob(order.id);
      const safeOrder = order.orderNumber || `order-${order.id}`;
      downloadBlobAsFile(blob, `payment-receipt-${safeOrder}.pdf`);
    } catch (err) {
      setDownloadError(
        getApiErrorMessage(err, "Unable to download payment summary")
      );
    } finally {
      setDownloadingReceipt(false);
    }
  };

  return (
    <CompanyPortalDashboardShell title="Order Complete">
      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <CompanyOrderStepper currentStep={4} />
          <CompanyOrderCompleteStep
            orderNumber={order?.orderNumber || ""}
            loading={loading}
            error={error}
            receiptUrl={order?.receiptUrl || ""}
            hasSubpoena={Boolean(order?.hasSubpoena)}
            onDownloadSubpoena={handleDownloadSubpoena}
            onDownloadPaymentReceipt={handleDownloadPaymentReceipt}
            downloadingSubpoena={downloadingSubpoena}
            downloadingReceipt={downloadingReceipt}
            downloadError={downloadError}
          />
        </section>
      </div>
    </CompanyPortalDashboardShell>
  );
}

export default function CompanyOrderCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
          Loading...
        </main>
      }
    >
      <CompanyOrderCompleteClient />
    </Suspense>
  );
}
