"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const initialFormData = {
  xrayInvoiceDate: "2026-06-02",
  examDate: "",
  views: "0",
  perViewAmount: "15.00",
  prepayment: "15.00",
  checkNumber: "9805",
  description: "",
};

export default function CreateXrayInvoiceModal({ isOpen, order, onClose }) {
  const [mounted, setMounted] = useState(false);
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

    setFormData(initialFormData);
    setErrors({});
  }, [isOpen, order]);

  const viewsAmount = useMemo(() => {
    return toNumber(formData.views) * toNumber(formData.perViewAmount);
  }, [formData.views, formData.perViewAmount]);

  const totalInvoiced = useMemo(() => {
    return viewsAmount - toNumber(formData.prepayment);
  }, [viewsAmount, formData.prepayment]);

  const balanceDue = totalInvoiced;

  if (!mounted || !isOpen || !order) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleViewsChange = (e) => {
    const cleanValue = e.target.value.replace(/\D/g, "");

    setFormData((prev) => ({
      ...prev,
      views: cleanValue,
    }));

    setErrors((prev) => ({
      ...prev,
      views: "",
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

  const handleSubmit = () => {
    const validationErrors = validateXrayInvoiceForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    console.log("Create X-Ray invoice:", {
      order,
      formData,
      viewsAmount,
      totalInvoiced,
      balanceDue,
    });

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
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
            New X-Ray Invoice
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
            <MetaItem label="Ref #" value={order.orderRef || "W-2785-3"} />

            <MetaItem
              label=""
              value={order.company?.name || order.provider || "N/A"}
              linkStyle
            />

            <MetaItem label="WCAB:" value={order.court || "N/A"} />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_170px]">
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateField
                label="X-Ray Invoice Date"
                name="xrayInvoiceDate"
                value={formData.xrayInvoiceDate}
                onChange={handleChange}
                error={errors.xrayInvoiceDate}
              />

              <DateField
                label="Exam Date"
                name="examDate"
                value={formData.examDate}
                onChange={handleChange}
                error={errors.examDate}
              />
            </div>

            <SectionTitle title="Views" />

            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
              <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[90px_auto_1fr]">
                <input
                  type="text"
                  inputMode="numeric"
                  name="views"
                  value={formData.views}
                  onChange={handleViewsChange}
                  className={`h-[34px] rounded-[6px] border bg-white px-3 text-center text-[12px] text-[#111827] outline-none focus:ring-2 ${
                    errors.views
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                      : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                  }`}
                />

                <div className="flex items-center gap-2 text-[12px] text-[#475569]">
                  <span>×</span>

                  <div className="relative w-[92px]">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#94A3B8]">
                      $
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      name="perViewAmount"
                      value={formData.perViewAmount}
                      onChange={handleMoneyChange}
                      className="h-[34px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-6 pr-2 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                    />
                  </div>

                  <span>/ view</span>
                </div>

                <div className="text-right text-[13px] font-semibold text-[#111827] sm:text-left">
                  = {formatMoney(viewsAmount)}
                </div>
              </div>

              {(errors.views || errors.perViewAmount) && (
                <p className="mt-2 text-[11px] text-red-500">
                  {errors.views || errors.perViewAmount}
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
                Description
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add a note or description..."
                rows={4}
                className="h-[74px] w-full resize-none rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>
          </div>

          <aside className="flex min-h-[220px] flex-col border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 lg:border-l lg:border-t-0">
            <h3 className="mb-4 text-[12px] font-semibold text-[#334155]">
              Summary
            </h3>

            <div className="space-y-3">
              <SummaryRow
                label={`Views (${toNumber(formData.views)})`}
                value={formatMoney(viewsAmount)}
              />

              <SummaryRow
                label="Prepayment"
                value={`-${formatMoney(toNumber(formData.prepayment))}`}
                danger
              />

              <p className="text-[10px] font-semibold text-[#059669]">
                ✓ CHK #{formData.checkNumber}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryRow
                label="Total Invoiced"
                value={formatMoney(totalInvoiced)}
                danger={totalInvoiced < 0}
              />

              <div className="rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-[#111827]">
                    Balance Due
                  </span>

                  <span
                    className={`text-[13px] font-bold ${
                      balanceDue < 0 ? "text-red-500" : "text-[#007F96]"
                    }`}
                  >
                    {formatMoney(balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={handleSubmit}
                className="h-[36px] w-full rounded-[7px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
              >
                Save Invoice
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

function SummaryRow({ label, value, danger = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-[#64748B]">{label}</span>

      <span
        className={`text-[11px] font-semibold ${
          danger ? "text-red-500" : "text-[#334155]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function validateXrayInvoiceForm(data) {
  const errors = {};

  if (!data.xrayInvoiceDate) {
    errors.xrayInvoiceDate = "Required";
  }

  if (data.views === "") {
    errors.views = "Required";
  }

  if (data.perViewAmount === "") {
    errors.perViewAmount = "Required";
  } else if (Number.isNaN(Number(data.perViewAmount))) {
    errors.perViewAmount = "Invalid amount";
  }

  if (data.prepayment === "" || Number.isNaN(Number(data.prepayment))) {
    errors.prepayment = "Invalid prepayment";
  }

  return errors;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value) {
  const absoluteValue = Math.abs(Number(value));

  const money = `$${absoluteValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return Number(value) < 0 ? `-${money}` : money;
}