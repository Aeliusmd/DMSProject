"use client";

import { useEffect, useMemo, useState } from "react";

function parseCurrency(value) {
  if (typeof value === "number") return value;

  const parsed = Number(String(value || "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function WriteOffInvoiceModal({
  isOpen,
  invoices = [],
  onClose,
  onSubmit,
}) {
  const [writeOffType, setWriteOffType] = useState("full");
  const [specifiedAmount, setSpecifiedAmount] = useState("");
  const [orderAction, setOrderAction] = useState("keep_write_off");
  const [error, setError] = useState("");

  const totalDue = useMemo(() => {
    return invoices.reduce(
      (total, invoice) => total + parseCurrency(invoice.due),
      0
    );
  }, [invoices]);

  const isBulkWriteOff = invoices.length > 1;
  const selectedInvoice = invoices[0];

  useEffect(() => {
    if (!isOpen) return;

    setWriteOffType("full");
    setSpecifiedAmount("");
    setOrderAction("keep_write_off");
    setError("");
  }, [isOpen, invoices]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const value = e.target.value;

    if (value === "") {
      setSpecifiedAmount("");
      setError("");
      return;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0) return;

    if (numericValue > totalDue) {
      setSpecifiedAmount(String(totalDue));
      setError(`Amount cannot be higher than ${formatCurrency(totalDue)}.`);
      return;
    }

    setSpecifiedAmount(value);
    setError("");
  };

  const handleSubmit = () => {
    setError("");

    if (totalDue <= 0) {
      setError("There is no due amount available to write off.");
      return;
    }

    if (!orderAction) {
      setError("Please choose whether to close the order or keep it as write off.");
      return;
    }

    const amountToWriteOff =
      isBulkWriteOff || writeOffType === "full"
        ? totalDue
        : Number(specifiedAmount);

    if (!Number.isFinite(amountToWriteOff) || amountToWriteOff <= 0) {
      setError("Please enter a valid write off amount.");
      return;
    }

    if (amountToWriteOff > totalDue) {
      setError(`Amount cannot be higher than ${formatCurrency(totalDue)}.`);
      return;
    }

    onSubmit?.({
      mode: isBulkWriteOff ? "bulk" : "single",
      writeOffType: isBulkWriteOff ? "full" : writeOffType,
      orderAction,
      amount: amountToWriteOff,
      totalDue,
      invoices: invoices.map((invoice) => {
        const dueAmount = parseCurrency(invoice.due);

        return {
          ...invoice,
          dueAmount,
          writeOffAmount: isBulkWriteOff ? dueAmount : amountToWriteOff,
        };
      }),
    });

    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-[560px] rounded-[12px] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-6 py-5">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Write Off Invoice
            </h2>

            <p className="mt-1 text-[12px] text-[#64748B]">
              {isBulkWriteOff
                ? `${invoices.length} invoices selected. The full due amount will be written off.`
                : `Case ${selectedInvoice?.caseNo || "N/A"}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] px-2 py-1 text-[18px] leading-none text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#111827]"
            aria-label="Close write off modal"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-[10px] border border-[#FEE2E2] bg-red-50 px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-500">
              Total Due Amount
            </p>

            <p className="mt-1 text-[24px] font-semibold text-red-600">
              {formatCurrency(totalDue)}
            </p>
          </div>

          {isBulkWriteOff ? (
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[12px] text-[#475569]">
              Bulk write off is enabled. Amount input is disabled because all
              selected invoice due amounts will be written off fully.
            </div>
          ) : (
            <div>
              <p className="mb-3 text-[12px] font-semibold text-[#334155]">
                Write Off Amount
              </p>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#E2E8F0] px-4 py-3 text-[12px] text-[#334155] hover:bg-[#F8FAFC]">
                  <input
                    type="radio"
                    name="writeOffType"
                    value="full"
                    checked={writeOffType === "full"}
                    onChange={() => {
                      setWriteOffType("full");
                      setSpecifiedAmount("");
                      setError("");
                    }}
                    className="h-[14px] w-[14px] accent-red-500"
                  />
                  Write off the full due amount
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#E2E8F0] px-4 py-3 text-[12px] text-[#334155] hover:bg-[#F8FAFC]">
                  <input
                    type="radio"
                    name="writeOffType"
                    value="specified"
                    checked={writeOffType === "specified"}
                    onChange={() => {
                      setWriteOffType("specified");
                      setError("");
                    }}
                    className="h-[14px] w-[14px] accent-red-500"
                  />
                  Specify write off amount
                </label>
              </div>

              {writeOffType === "specified" && (
                <div className="mt-3">
                  <label className="mb-2 block text-[11px] font-medium text-[#64748B]">
                    Amount to write off
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    max={totalDue}
                    step="0.01"
                    value={specifiedAmount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                  />

                  <p className="mt-2 text-[11px] text-[#64748B]">
                    Amount must be equal to or lower than{" "}
                    {formatCurrency(totalDue)}.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-3 text-[12px] font-semibold text-[#334155]">
              After Write Off
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#E2E8F0] px-4 py-3 text-[12px] text-[#334155] hover:bg-[#F8FAFC]">
                <input
                  type="radio"
                  name="orderAction"
                  value="close_order"
                  checked={orderAction === "close_order"}
                  onChange={() => setOrderAction("close_order")}
                  className="h-[14px] w-[14px] accent-red-500"
                />
                Close the order
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#E2E8F0] px-4 py-3 text-[12px] text-[#334155] hover:bg-[#F8FAFC]">
                <input
                  type="radio"
                  name="orderAction"
                  value="keep_write_off"
                  checked={orderAction === "keep_write_off"}
                  onChange={() => setOrderAction("keep_write_off")}
                  className="h-[14px] w-[14px] accent-red-500"
                />
                Keep this as write off
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#E2E8F0] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-[36px] rounded-[6px] bg-[#F1F5F9] px-5 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="h-[36px] rounded-[6px] bg-red-500 px-5 text-[12px] font-semibold text-white hover:bg-red-600"
          >
            Confirm Write Off
          </button>
        </div>
      </div>
    </div>
  );
}