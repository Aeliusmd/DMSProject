"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import {
  createInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/invoices/invoiceApi";
import {
  buildPaymentLinesFromOrder,
  formatMoneyAmount,
  getPaymentLineAmount,
  mapDueFormToInvoiceFees,
  mapInvoiceFeesToDueForm,
  resolveFullFeeAmounts,
  resolvePersistedInvoiceAmounts,
} from "@/lib/orders/paymentUtils";
import {
  calculateOrderRushLevel,
} from "@/lib/orders/rushUtils";
import { getOrder } from "@/lib/orders/orderApi";
import { getTodayInputDate } from "@/lib/utils/dateUtils";

const initialFormData = {
  invoiceDate: "",
  serviceDate: "",
  storageFee: "0.00",
  pages: "0",
  perPageAmount: "0.00",
  clericalTimeHours: "0",
  clericalHourlyRate: "0.00",
  shippingHandling: "0.00",
  notes: "",
  sendOrderDetails: false,
  rushOrder: false,
};

export default function CreateInvoiceModal({
  isOpen,
  order,
  onClose,
  onSaved,
  mode = "create",
}) {
  const mounted = useIsClient();
  const isEditMode = mode === "edit";

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [paymentLines, setPaymentLines] = useState([]);
  const [prepaymentAmount, setPrepaymentAmount] = useState("0.00");
  const [rushLevel, setRushLevel] = useState(null);
  const [persistedInvoiceMeta, setPersistedInvoiceMeta] = useState(null);

  const openSession =
    isOpen && order ? `${order.id || order.orderNo}-${isEditMode}` : null;
  const [prevOpenSession, setPrevOpenSession] = useState(null);

  if (openSession !== prevOpenSession) {
    setPrevOpenSession(openSession);

    if (openSession) {
      setFormData(getInitialInvoiceFormData(order, isEditMode));
      setErrors({});
    }
  }

  useEffect(() => {
    if (!isOpen || !order?.dbId) return;

    let cancelled = false;

    async function loadInvoice() {
      setLoadingInvoice(true);
      setSubmitError("");

      try {
        const orderData = await getOrder(order.dbId);

        if (cancelled) return;

        const derivedRushLevel = calculateOrderRushLevel(orderData.createdAt);
        setRushLevel(derivedRushLevel);
        const loadedPaymentLines = buildPaymentLinesFromOrder(orderData);
        setPaymentLines(loadedPaymentLines);
        const loadedPrepayment = getPaymentLineAmount(loadedPaymentLines, "prepayment");
        setPrepaymentAmount(loadedPrepayment > 0 ? loadedPrepayment.toFixed(2) : "0.00");

        const invoiceId = order.invoiceId || order.invoice?.invoiceId;

        if (isEditMode && invoiceId) {
          const invoice = await getInvoice(invoiceId);
          if (cancelled) return;

          setFormData(
            mapInvoiceFeesToDueForm(mapInvoiceToFormData(invoice, order))
          );
          setPersistedInvoiceMeta({
            status: invoice.status,
            writeoffAmount: invoice.writeoffAmount || 0,
          });
          setRushLevel(invoice.rushLevel || derivedRushLevel);
          return;
        }

        setPersistedInvoiceMeta(null);
        setFormData({
          ...getInitialInvoiceFormData(order, isEditMode),
          rushOrder: Boolean(derivedRushLevel),
        });
      } catch (error) {
        if (!cancelled) {
          setSubmitError(error.message || "Failed to load invoice");
          const fallbackLines = buildPaymentLinesFromOrder(order);
          setPaymentLines(fallbackLines);
          setFormData(getInitialInvoiceFormData(order, isEditMode));
        }
      } finally {
        if (!cancelled) {
          setLoadingInvoice(false);
        }
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [isOpen, order?.dbId, isEditMode, order?.invoiceId, order?.invoice?.invoiceId]);

  useEffect(() => {
    if (!openSession) {
      setPaymentLines([]);
      setPrepaymentAmount("0.00");
      setRushLevel(null);
    }
  }, [openSession]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const pagesAmount = useMemo(() => {
    return toNumber(formData.pages) * toNumber(formData.perPageAmount);
  }, [formData.pages, formData.perPageAmount]);

  const clericalAmount = useMemo(() => {
    return (
      toNumber(formData.clericalTimeHours) * toNumber(formData.clericalHourlyRate)
    );
  }, [formData.clericalTimeHours, formData.clericalHourlyRate]);

  const fullFees = useMemo(() => {
    return resolveFullFeeAmounts(formData);
  }, [formData]);

  const totalAmount = useMemo(() => {
    return (
      pagesAmount +
      clericalAmount +
      toNumber(formData.shippingHandling) +
      fullFees.storageFee
    );
  }, [formData, fullFees, pagesAmount, clericalAmount]);

  const prepaymentPaid = useMemo(() => {
    return toNumber(prepaymentAmount);
  }, [prepaymentAmount]);

  const amountPaid = useMemo(() => {
    return prepaymentPaid;
  }, [prepaymentPaid]);

  const invoiceTotals = useMemo(
    () =>
      resolvePersistedInvoiceAmounts(totalAmount, amountPaid, {
        writeoffAmount: persistedInvoiceMeta?.writeoffAmount || 0,
        persistedStatus: persistedInvoiceMeta?.status || null,
      }),
    [totalAmount, amountPaid, persistedInvoiceMeta]
  );

  const { amountDue, overpayment, status: invoiceStatus, isOverpaid } =
    invoiceTotals;

  if (!mounted || !isOpen || !order) return null;

  const modalTitle = isEditMode ? "Edit Invoice" : "Create Invoice";
  const submitLabel = isEditMode ? "Edit Invoice" : "Create Invoice";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleMoneyChange = (e) => {
    const { name, value } = e.target;

    const cleanValue = value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d*\.\d{0,2}).*$/, "$1");

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handlePagesChange = (e) => {
    const { value } = e.target;
    const cleanValue = value.replace(/\D/g, "");

    setFormData((prev) => ({
      ...prev,
      pages: cleanValue,
    }));

    setErrors((prev) => ({
      ...prev,
      pages: "",
    }));
  };

  const handleClericalHoursChange = (e) => {
    const { value } = e.target;
    const cleanValue = value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d*\.\d{0,2}).*$/, "$1");

    setFormData((prev) => ({
      ...prev,
      clericalTimeHours: cleanValue,
    }));

    setErrors((prev) => ({
      ...prev,
      clericalTimeHours: "",
    }));
  };

  const handlePrepaymentChange = (e) => {
    const cleanValue = e.target.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d*\.\d{0,2}).*$/, "$1");

    const amount = toNumber(cleanValue);
    setPrepaymentAmount(cleanValue);

    setPaymentLines((prev) => {
      const others = prev.filter((line) => line.type !== "prepayment");
      if (amount <= 0) return others;

      return [
        ...others,
        {
          type: "prepayment",
          label: "Prepayment",
          amount,
          bracketLabel: `Prepayment (${formatMoney(amount)})`,
        },
      ];
    });
  };

  const handleSubmit = async () => {
    const validationErrors = validateInvoiceForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    const feePayload = mapDueFormToInvoiceFees(formData);

    const payload = {
      orderId: order.dbId,
      activeType: isEditMode ? "Edit Invoice" : "Create Invoice",
      ...feePayload,
      pagesAmount,
      clericalAmount,
      totalAmount,
      prepaymentAmount: toNumber(prepaymentAmount),
    };

    setSubmitting(true);
    setSubmitError("");

    try {
      const invoiceId = order.invoiceId || order.invoice?.invoiceId;
      const completingXrayOnlyStub =
        !isEditMode && invoiceId && order.invoice?.createOnly;

      if ((isEditMode || completingXrayOnlyStub) && invoiceId) {
        await updateInvoice(invoiceId, payload);
      } else {
        await createInvoice(payload);
      }

      onSaved?.();
      onClose();
    } catch (error) {
      setSubmitError(error.message || "Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 sm:py-6">
      <section className="flex max-h-[100dvh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-[12px] bg-white shadow-2xl sm:max-h-[calc(100vh-42px)] sm:rounded-[10px]">
        <div className="relative shrink-0 bg-gradient-to-r from-[#008AA3] via-[#0A96AA] to-[#56AFC0] px-4 py-4 text-white sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-[24px] w-[24px] items-center justify-center rounded-[6px] bg-white/15 text-[15px] leading-none text-white hover:bg-white/25"
            aria-label="Close modal"
          >
            ×
          </button>

          <h2 className="text-[15px] font-semibold leading-none">
            {modalTitle}
          </h2>

          <p className="mt-3 text-[11px] font-medium text-white/90">
            Order{" "}
            <span className="font-semibold text-white">
              {order.id || order.orderNo}
            </span>{" "}
            <span className="mx-1">•</span>
            {order.applicant || "N/A"}
          </p>
        </div>

        <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-4 py-3 sm:px-5">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max flex-wrap items-center gap-x-5 gap-y-2 text-[11px] sm:min-w-0">
            <MetaItem label="# ID" value={order.id || order.orderNo} />
            <MetaItem
              label=""
              value={order.company?.name || order.provider || "N/A"}
              linkStyle
            />

            <MetaItem label="Invoiced" value={formatMoney(totalAmount)} />
            <MetaItem label="Paid" value={formatMoney(amountPaid)} />
            <MetaItem label="Due" value={formatMoney(amountDue)} />
            {persistedInvoiceMeta?.writeoffAmount > 0 && (
              <MetaItem
                label="Written Off"
                value={formatMoney(persistedInvoiceMeta.writeoffAmount)}
              />
            )}
            {isOverpaid && (
              <MetaItem label="Credit" value={formatMoney(overpayment)} />
            )}
            <MetaItem label="Status" value={invoiceStatus} />
            {rushLevel && <MetaItem label="Rush Level" value={rushLevel} />}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateField
                label="Invoice Date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                error={errors.invoiceDate}
              />

              <DateField
                label="Service Date"
                name="serviceDate"
                value={formData.serviceDate}
                onChange={handleChange}
                error={errors.serviceDate}
              />
            </div>

            <SectionTitle title="Fees" />

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MoneyField
                label="Prepayment"
                name="prepaymentAmount"
                value={prepaymentAmount}
                onChange={handlePrepaymentChange}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyField
                label="Storage Fee"
                name="storageFee"
                value={formData.storageFee}
                onChange={handleMoneyChange}
                error={errors.storageFee}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField
                label="Pages"
                name="pages"
                value={formData.pages}
                onChange={handlePagesChange}
                error={errors.pages}
              />

              <MoneyField
                label="Per Page Amount"
                name="perPageAmount"
                value={formData.perPageAmount}
                onChange={handleMoneyChange}
                error={errors.perPageAmount}
              />

              <ReadOnlyMoneyField label="Pages Amount" value={pagesAmount} />
            </div>

            <SectionTitle title="Clerical Time" />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField
                label="Clerical Time (Hours)"
                name="clericalTimeHours"
                value={formData.clericalTimeHours}
                onChange={handleClericalHoursChange}
                error={errors.clericalTimeHours}
              />

              <MoneyField
                label="Per Hour Charge"
                name="clericalHourlyRate"
                value={formData.clericalHourlyRate}
                onChange={handleMoneyChange}
                error={errors.clericalHourlyRate}
              />

              <ReadOnlyMoneyField
                label="Clerical Time Charge"
                value={clericalAmount}
              />
            </div>

            <SectionTitle title="Shipping & Handling" />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyField
                label="Shipping & Handling Fee"
                name="shippingHandling"
                value={formData.shippingHandling}
                onChange={handleMoneyChange}
                error={errors.shippingHandling}
              />
            </div>

            <div className="mt-3">
              <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
                Notes
              </label>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Invoice notes..."
                rows={2}
                className="h-[52px] w-full resize-none rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-5">
                <CheckboxField
                  label="Send Order Details"
                  name="sendOrderDetails"
                  checked={formData.sendOrderDetails}
                  onChange={handleChange}
                />

                <CheckboxField
                  label="Rush Order"
                  name="rushOrder"
                  checked={formData.rushOrder}
                  onChange={handleChange}
                />
              </div>

              
            </div>
          </div>

          <aside className="flex min-h-[210px] flex-col border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 md:border-l md:border-t-0 md:px-4">
            <h3 className="mb-4 text-[12px] font-semibold text-[#334155]">
              Summary
            </h3>

            <div className="space-y-3">
              <SummaryRow
                label="Storage Fee"
                value={formatMoney(fullFees.storageFee)}
              />
              <SummaryRow label="Pages" value={formatMoney(pagesAmount)} />
              <SummaryRow
                label="Clerical Time"
                value={formatMoney(clericalAmount)}
              />
              <SummaryRow
                label="Shipping & Handling"
                value={formatMoney(toNumber(formData.shippingHandling))}
              />
            </div>

            <div className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4">
              <SummaryRow label="Subtotal" value={formatMoney(totalAmount)} />
              {prepaymentPaid > 0 && (
                <SummaryRow
                  label="Prepayment"
                  value={`-${formatMoney(prepaymentPaid)}`}
                  muted
                />
              )}
              {persistedInvoiceMeta?.writeoffAmount > 0 && (
                <SummaryRow
                  label="Written Off"
                  value={`-${formatMoney(persistedInvoiceMeta.writeoffAmount)}`}
                  muted
                />
              )}
              <SummaryRow label="Due" value={formatMoney(amountDue)} highlight />
              {isOverpaid && (
                <SummaryRow
                  label="Credit"
                  value={formatMoney(overpayment)}
                  highlight
                />
              )}
            </div>

            <div className="mt-5 rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-[#111827]">
                  Total
                </span>

                <span className="text-[15px] font-bold text-[#007F96]">
                  {formatMoney(amountDue)}
                </span>
              </div>
            </div>

            <div className="mt-auto pt-6">
              {submitError && (
                <p className="mb-3 text-[11px] text-red-500">{submitError}</p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingInvoice}
                className="h-[36px] w-full rounded-[7px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Saving..."
                  : loadingInvoice
                    ? "Loading..."
                    : submitLabel}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="mt-3 h-[30px] w-full rounded-[6px] text-[12px] font-semibold text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#475569]"
              >
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}

function getInitialInvoiceFormData(order, isEditMode) {
  if (!isEditMode) {
    return {
      ...initialFormData,
      invoiceDate: getTodayInputDate(),
    };
  }

  const invoice = order?.invoice || {};

  return {
    ...initialFormData,
    invoiceDate: toDateInput(invoice.date) || initialFormData.invoiceDate,
    serviceDate: toDateInput(invoice.sentDateRaw || invoice.sentDate) || "",
    storageFee: invoice.storageFee || invoice.other || "0.00",
    pages: invoice.pages || "0",
    perPageAmount: invoice.perPageAmount || "0.00",
    clericalTimeHours: invoice.clericalTimeHours || "0",
    clericalHourlyRate: invoice.clericalHourlyRate || "0.00",
    shippingHandling: invoice.shippingHandling || "0.00",
    notes: invoice.notes || `Editing invoice for order ${order?.id || order?.orderNo || ""}`,
    sendOrderDetails: Boolean(invoice.sendOrderDetails),
    rushOrder: Boolean(invoice.rushOrder),
  };
}

function mapInvoiceToFormData(invoice, order) {
  if (!invoice) {
    return getInitialInvoiceFormData(order, true);
  }

  return {
    invoiceDate: invoice.invoiceDate || initialFormData.invoiceDate,
    serviceDate: invoice.serviceDate || "",
    storageFee: invoice.storageFee || "0.00",
    pages: invoice.pages || "0",
    perPageAmount: invoice.perPageAmount || "0.00",
    clericalTimeHours: invoice.clericalTimeHours || "0",
    clericalHourlyRate: invoice.clericalHourlyRate || "0.00",
    shippingHandling: invoice.shippingHandling || "0.00",
    notes: invoice.notes || "",
    sendOrderDetails: Boolean(invoice.sendOrderDetails),
    rushOrder: Boolean(invoice.rushOrder),
  };
}

function toDateInput(dateValue) {
  if (!dateValue) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const parts = String(dateValue).split("/");

  if (parts.length !== 3) {
    return "";
  }

  const [month, day, year] = parts;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function moneyToInput(value, fallback = "0.00") {
  if (!value) return fallback;

  const cleanValue = String(value).replace(/[^\d.]/g, "");
  const numberValue = Number(cleanValue);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return numberValue.toFixed(2);
}

function MetaItem({ label, value, linkStyle = false }) {
  return (
    <p className="text-[#64748B]">
      {label && <span className="mr-1">{label}</span>}
      <span
        className={`font-semibold ${
          linkStyle ? "text-[#007F96]" : "text-[#334155]"
        }`}
      >
        {value}
      </span>
    </p>
  );
}

function SectionTitle({ title }) {
  return (
    <h3 className="mb-2 mt-4 text-[11px] font-semibold text-[#64748B]">
      {title}
    </h3>
  );
}

function DateField({ label, name, value, onChange, error = "" }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className={`h-[34px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function FieldLabel({ label, paymentHint, helperText }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
      {label}
      {paymentHint ? ` ${paymentHint}` : ""}
      {helperText ? (
        <span className="ml-1 font-normal text-[#94A3B8]">· {helperText}</span>
      ) : null}
    </label>
  );
}

function MoneyField({
  label,
  name,
  value,
  onChange,
  error = "",
  paymentHint,
  helperText,
}) {
  return (
    <div>
      <FieldLabel
        label={label}
        paymentHint={paymentHint}
        helperText={helperText}
      />

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94A3B8]">
          $
        </span>

        <input
          type="text"
          inputMode="decimal"
          name={name}
          value={value}
          onChange={onChange}
          className={`h-[34px] w-full rounded-[6px] border bg-white pl-7 pr-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
        />
      </div>

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function ReadOnlyMoneyField({ label, value, paymentHint, helperText }) {
  return (
    <div>
      <FieldLabel
        label={label}
        paymentHint={paymentHint}
        helperText={helperText}
      />

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94A3B8]">
          $
        </span>

        <input
          type="text"
          value={Number(value).toFixed(2)}
          readOnly
          className="h-[34px] w-full cursor-not-allowed rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] pl-7 pr-3 text-[12px] font-semibold text-[#007F96] outline-none"
        />
      </div>
    </div>
  );
}

function NumberField({ label, name, value, onChange, error = "" }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
        {label}
      </label>

      <input
        type="text"
        inputMode="numeric"
        name={name}
        value={value}
        onChange={onChange}
        className={`h-[34px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function CheckboxField({ label, name, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-[#64748B]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
      />
      {label}
    </label>
  );
}

function SummaryRow({ label, value, highlight = false, muted = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-[#64748B]">{label}</span>
      <span
        className={`text-[11px] font-semibold ${
          highlight
            ? "text-[#059669]"
            : muted
              ? "text-red-500"
              : "text-[#334155]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function validateInvoiceForm(data) {
  const errors = {};

  if (!data.invoiceDate) {
    errors.invoiceDate = "Required";
  }

  const moneyFields = [
    "storageFee",
    "perPageAmount",
    "clericalHourlyRate",
    "shippingHandling",
  ];

  moneyFields.forEach((field) => {
    if (data[field] === "") {
      errors[field] = "Required";
    } else if (Number.isNaN(Number(data[field]))) {
      errors[field] = "Invalid";
    }
  });

  if (data.pages === "") {
    errors.pages = "Required";
  } else if (Number(data.pages) < 0) {
    errors.pages = "Invalid";
  }

  if (data.clericalTimeHours === "") {
    errors.clericalTimeHours = "Required";
  } else if (Number(data.clericalTimeHours) < 0) {
    errors.clericalTimeHours = "Invalid";
  }

  return errors;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}