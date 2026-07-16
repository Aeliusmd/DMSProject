"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpoenaExtractionOverlay from "@/components/orders/new-order/SubpoenaExtractionOverlay";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyOrderStepper from "@/components/company-portal/CompanyOrderStepper";
import CompanyOrderUploadStep from "@/components/company-portal/CompanyOrderUploadStep";
import CompanyOrderVerifyStep from "@/components/company-portal/CompanyOrderVerifyStep";
import CompanyOrderPaymentStep from "@/components/company-portal/CompanyOrderPaymentStep";
import {
  clearCompanyOrderWizardState,
  createCompanyPortalCheckout,
  loadCompanyOrderWizardState,
  saveCompanyOrderWizardState,
  uploadCompanyPortalSubpoena,
  COMPANY_PORTAL_ORDER_FEE,
} from "@/lib/company-portal/companyPortalOrderApi";
import {
  createEmptyCompanyOrderForm,
  validateCompanyOrderForm,
} from "@/lib/company-portal/companyPortalOrderUtils";
import {
  getStoredCompanyUser,
  isCompanyAuthenticated,
} from "@/lib/company-portal/companyPortalAuthStorage";
import { getCompanyWalletSummary } from "@/lib/company-portal/companyPortalManagementApi";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
} from "@/lib/apiErrorUtils";

function CompanyOrderCreateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [uploadToken, setUploadToken] = useState("");
  const [form, setForm] = useState(createEmptyCompanyOrderForm());
  const [errors, setErrors] = useState({});
  const [fileMeta, setFileMeta] = useState(null);
  const [localFile, setLocalFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [canceled, setCanceled] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const storedUser = getStoredCompanyUser();
  const isEmployee = storedUser?.isAdmin === false;
  const availableWalletBalance = isEmployee
    ? Number(storedUser?.walletBalance || 0)
    : Number(walletBalance || 0);
  const hasEnoughWalletBalance = availableWalletBalance >= COMPANY_PORTAL_ORDER_FEE;

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
    }
  }, [router]);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const wasCanceled = searchParams.get("canceled") === "1";
    if (wasCanceled) setCanceled(true);

    const saved = loadCompanyOrderWizardState();
    if (saved?.uploadToken) {
      setUploadToken(saved.uploadToken);
      if (saved.form) setForm({ ...createEmptyCompanyOrderForm(), ...saved.form });
      if (saved.fileMeta) setFileMeta(saved.fileMeta);
      if (stepParam === "payment" || wasCanceled) setStep(3);
      else if (stepParam === "verify" || saved.form) setStep(2);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (isEmployee) {
      setWalletLoading(false);
      return;
    }

    let active = true;
    setWalletLoading(true);

    getCompanyWalletSummary()
      .then((response) => {
        if (!active) return;
        setWalletBalance(response?.data?.unallocatedBalance || 0);
      })
      .catch(() => {
        if (!active) return;
        setWalletBalance(0);
      })
      .finally(() => {
        if (active) setWalletLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isEmployee]);

  const persistWizard = (next = {}) => {
    saveCompanyOrderWizardState({
      uploadToken: next.uploadToken ?? uploadToken,
      form: next.form ?? form,
      fileMeta: next.fileMeta ?? fileMeta,
      step: next.step ?? step,
    });
  };

  const handleFileSelected = (file) => {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !String(file.name || "").toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are allowed");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("PDF must be 50MB or smaller");
      return;
    }

    setError("");
    setLocalFile(file);
    setFileMeta({ name: file.name, size: file.size });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setLocalFile(null);
    setFileMeta(null);
    setUploadToken("");
    clearCompanyOrderWizardState();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setError("");
  };

  const handleProcess = async () => {
    if (!localFile || extracting) return;

    if (!hasEnoughWalletBalance) {
      setError(
        `Wallet balance is below $${COMPANY_PORTAL_ORDER_FEE.toFixed(
          2
        )}. Please top up before creating an order.`
      );
      return;
    }

    setExtracting(true);
    setError("");

    try {
      const response = await uploadCompanyPortalSubpoena(localFile);
      const data = response?.data || {};
      if (!data.uploadToken) {
        throw new Error("Upload succeeded but no session token was returned");
      }

      const nextForm = {
        ...createEmptyCompanyOrderForm(),
        ...(data.form || {}),
      };
      const nextMeta = data.fileMeta || {
        name: localFile.name,
        size: localFile.size,
      };

      setUploadToken(data.uploadToken);
      setForm(nextForm);
      setFileMeta(nextMeta);
      setStep(2);
      persistWizard({
        uploadToken: data.uploadToken,
        form: nextForm,
        fileMeta: nextMeta,
        step: 2,
      });
      router.replace("/company-portal/orders/new?step=verify");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to process subpoena"));
    } finally {
      setExtracting(false);
    }
  };

  const handleFormChange = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      persistWizard({ form: next });
      return next;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleRecordTypesChange = (event) => {
    const { name, value } = event.target;
    if (name === "recordTypes" && value && typeof value === "object") {
      setForm((prev) => {
        const next = { ...prev, ...value };
        persistWizard({ form: next });
        return next;
      });
      setErrors((prev) => {
        if (!prev.type) return prev;
        const next = { ...prev };
        delete next.type;
        return next;
      });
    }
  };

  const handleContinueToPayment = () => {
    const nextErrors = validateCompanyOrderForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !uploadToken) {
      if (!uploadToken) {
        setError("Please upload and process a subpoena first.");
        setStep(1);
      }
      return;
    }

    setError("");
    setStep(3);
    persistWizard({ step: 3 });
    router.replace("/company-portal/orders/new?step=payment");
  };

  const handlePay = async () => {
    if (!uploadToken || paying) return;

    const nextErrors = validateCompanyOrderForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(2);
      return;
    }

    setPaying(true);
    setError("");
    persistWizard({ step: 3 });

    try {
      const response = await createCompanyPortalCheckout({
        uploadToken,
        ...form,
      });
      const payload = response?.data || {};

      if (payload.paymentMethod === "wallet" && payload.order?.orderNumber) {
        clearCompanyOrderWizardState();
        router.push(
          `/company-portal/orders/complete?order_number=${encodeURIComponent(payload.order.orderNumber)}`
        );
        return;
      }

      const checkoutUrl = payload.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Unable to start checkout");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setStep(2);
      }
      setError(message || getApiErrorMessage(err, "Unable to start payment"));
      setPaying(false);
    }
  };

  return (
    <CompanyPortalDashboardShell title="Create Order">
      <SubpoenaExtractionOverlay open={extracting} />

      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <CompanyOrderStepper currentStep={step} />

          {step === 1 ? (
            <>
              {!walletLoading && !hasEnoughWalletBalance ? (
                <div className="mb-5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[13px] font-semibold text-amber-800">
                    Wallet balance is too low
                  </p>
                  <p className="mt-1 text-[12px] text-amber-700">
                    You need at least ${COMPANY_PORTAL_ORDER_FEE.toFixed(2)} to
                    upload and process a subpoena. Current balance: $
                    {availableWalletBalance.toFixed(2)}.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/company-portal/money")}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
                  >
                    Top up wallet
                  </button>
                </div>
              ) : null}

              <CompanyOrderUploadStep
                fileMeta={fileMeta}
                previewUrl={previewUrl}
                extracting={extracting}
                error={error}
                onFileSelected={handleFileSelected}
                onRemoveFile={handleRemoveFile}
                onProcess={handleProcess}
              />
            </>
          ) : null}

          {step === 2 ? (
            <CompanyOrderVerifyStep
              form={form}
              errors={errors}
              onChange={handleFormChange}
              onRecordTypesChange={handleRecordTypesChange}
              onBack={() => setStep(1)}
              onContinue={handleContinueToPayment}
              saving={false}
            />
          ) : null}

          {step === 3 ? (
            <CompanyOrderPaymentStep
              form={form}
              fileName={fileMeta?.name}
              amount={COMPANY_PORTAL_ORDER_FEE}
              isEmployee={isEmployee}
              walletBalance={availableWalletBalance}
              onBack={() => setStep(2)}
              onPay={handlePay}
              paying={paying}
              error={error}
              canceled={false}
            />
          ) : null}
        </section>
      </div>
    </CompanyPortalDashboardShell>
  );
}

export default function CompanyOrderCreatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
          Loading order form...
        </main>
      }
    >
      <CompanyOrderCreateClient />
    </Suspense>
  );
}
