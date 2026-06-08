"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const invoiceTypes = [
  "Create Invoice",
  "Create Insurance Bill",
  "Create Custodian Invoice",
];

const initialFormData = {
  invoiceDate: "2026-06-02",
  serviceDate: "",
  servedAmount: "10.00",
  serviceFee: "250.00",
  custodianFee: "100.00",
  xrayFee: "0.00",
  mileage: "0.00",
  parking: "0.00",
  other: "0.00",
  pages: "0",
  perPageAmount: "0.00",
  notes: "",
  sendOrderDetails: false,
  rushOrder: false,
};

export default function CreateInvoiceModal({ isOpen, order, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [activeType, setActiveType] = useState("Create Invoice");
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setActiveType("Create Invoice");
    setFormData(initialFormData);
    setErrors({});
  }, [isOpen, order]);

  const pagesAmount = useMemo(() => {
    return toNumber(formData.pages) * toNumber(formData.perPageAmount);
  }, [formData.pages, formData.perPageAmount]);

  const totalAmount = useMemo(() => {
    return (
      toNumber(formData.servedAmount) +
      toNumber(formData.serviceFee) +
      toNumber(formData.custodianFee) +
      toNumber(formData.xrayFee) +
      toNumber(formData.mileage) +
      toNumber(formData.parking) +
      toNumber(formData.other) +
      pagesAmount
    );
  }, [formData, pagesAmount]);

  if (!mounted || !isOpen || !order) return null;

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

  const handleSubmit = () => {
    const validationErrors = validateInvoiceForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    console.log("Create invoice:", {
      type: activeType,
      order,
      formData,
      pagesAmount,
      totalAmount,
    });

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[700px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="relative shrink-0 bg-gradient-to-r from-[#008AA3] via-[#0A96AA] to-[#56AFC0] px-5 py-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-[24px] w-[24px] items-center justify-center rounded-[6px] bg-white/15 text-[15px] leading-none text-white hover:bg-white/25"
            aria-label="Close modal"
          >
            ×
          </button>

          <h2 className="text-[15px] font-semibold leading-none">
            Create Invoice
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

        <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
            <MetaItem label="# ID" value={order.id || order.orderNo} />
            <MetaItem
              label=""
              value={order.company?.name || order.provider || "N/A"}
              linkStyle
            />
          </div>
        </div>

        <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-5">
          <div className="flex flex-wrap items-center gap-6">
            {invoiceTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`relative h-[42px] text-[11px] font-semibold transition ${
                  activeType === type
                    ? "text-[#007F96]"
                    : "text-[#475569] hover:text-[#007F96]"
                }`}
              >
                {type}

                {activeType === type && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#0097B2]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_170px]">
          <div className="min-h-0 overflow-y-auto px-5 py-4">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MoneyField
                label="Served Amount"
                name="servedAmount"
                value={formData.servedAmount}
                onChange={handleMoneyChange}
                error={errors.servedAmount}
              />

              <MoneyField
                label="Service Fee"
                name="serviceFee"
                value={formData.serviceFee}
                onChange={handleMoneyChange}
                error={errors.serviceFee}
              />

              <MoneyField
                label="Custodian Fee"
                name="custodianFee"
                value={formData.custodianFee}
                onChange={handleMoneyChange}
                error={errors.custodianFee}
              />
            </div>

            <SectionTitle title="Additional Charges" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MoneyField
                label="X-Ray Fee"
                name="xrayFee"
                value={formData.xrayFee}
                onChange={handleMoneyChange}
                error={errors.xrayFee}
              />

              <MoneyField
                label="Mileage"
                name="mileage"
                value={formData.mileage}
                onChange={handleMoneyChange}
                error={errors.mileage}
              />

              <MoneyField
                label="Parking"
                name="parking"
                value={formData.parking}
                onChange={handleMoneyChange}
                error={errors.parking}
              />

              <MoneyField
                label="Other"
                name="other"
                value={formData.other}
                onChange={handleMoneyChange}
                error={errors.other}
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

            <div className="mt-4 flex flex-wrap items-center gap-5">
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

          <aside className="flex min-h-[210px] flex-col border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 lg:border-l lg:border-t-0">
            <h3 className="mb-4 text-[12px] font-semibold text-[#334155]">
              Summary
            </h3>

            <div className="space-y-3">
              <SummaryRow
                label="Served Amount"
                value={formatMoney(toNumber(formData.servedAmount))}
              />
              <SummaryRow
                label="Service Fee"
                value={formatMoney(toNumber(formData.serviceFee))}
              />
              <SummaryRow
                label="Custodian Fee"
                value={formatMoney(toNumber(formData.custodianFee))}
              />
              <SummaryRow label="Pages" value={formatMoney(pagesAmount)} />
            </div>

            <div className="mt-5 rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-[#111827]">
                  Total
                </span>

                <span className="text-[15px] font-bold text-[#007F96]">
                  {formatMoney(totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={handleSubmit}
                className="h-[36px] w-full rounded-[7px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
              >
                Create Invoice
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

function MoneyField({ label, name, value, onChange, error = "" }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
        {label}
      </label>

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

function ReadOnlyMoneyField({ label, value }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
        {label}
      </label>

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

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-[#64748B]">{label}</span>
      <span className="text-[11px] font-semibold text-[#334155]">{value}</span>
    </div>
  );
}

function validateInvoiceForm(data) {
  const errors = {};

  if (!data.invoiceDate) {
    errors.invoiceDate = "Required";
  }

  const moneyFields = [
    "servedAmount",
    "serviceFee",
    "custodianFee",
    "xrayFee",
    "mileage",
    "parking",
    "other",
    "perPageAmount",
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