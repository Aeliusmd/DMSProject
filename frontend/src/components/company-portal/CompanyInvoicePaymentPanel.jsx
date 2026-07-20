"use client";

import { useState } from "react";
import Link from "next/link";
import {
  payCompanyPortalInvoice,
} from "@/lib/company-portal/companyPortalOrderApi";
import { getStoredCompanyUser } from "@/lib/company-portal/companyPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function CompanyInvoicePaymentPanel({
  orderNumber,
  paymentLinks = [],
  walletBalance = null,
  walletBalanceDisplay = null,
  walletBalanceSource = null,
  onOrderUpdated,
}) {
  const storedUser = getStoredCompanyUser();
  const isEmployee =
    storedUser?.isAdmin === false || walletBalanceSource === "employee";

  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [payingType, setPayingType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activePaymentMethod = isEmployee ? "wallet" : paymentMethod;
  const walletLabel =
    walletBalanceSource === "employee" || isEmployee
      ? "Employee wallet"
      : "Company wallet";
  const canPayWithWallet =
    walletBalance != null && Number(walletBalance) > 0;

  const handlePay = async (link) => {
    setError("");
    setSuccess("");
    setPayingType(link.type);

    const method = isEmployee ? "wallet" : paymentMethod;

    try {
      const result = await payCompanyPortalInvoice(orderNumber, {
        invoiceType: link.type,
        paymentMethod: method,
      });

      if (method === "stripe" && result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      setSuccess(`${link.label} paid successfully.`);
      if (result?.order && onOrderUpdated) {
        onOrderUpdated(result.order);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to process invoice payment"));
    } finally {
      setPayingType("");
    }
  };

  if (!paymentLinks.length) {
    return null;
  }

  return (
    <div className="mt-5 rounded-[8px] border border-[#BAE6FD] bg-[#F0F9FF] px-4 py-3">
      <p className="text-[12px] font-semibold text-[#0369A1]">
        Outstanding invoice payments
      </p>
      <p className="mt-1 text-[12px] text-[#0C4A6E]">
        {isEmployee
          ? "Pay remaining invoice balances from your allocated wallet balance."
          : "Pay remaining invoice balances from your wallet or by card."}
      </p>

      {walletBalanceDisplay ? (
        <p className="mt-2 text-[12px] text-[#0F172A]">
          {walletLabel} balance:{" "}
          <span className="font-semibold">{walletBalanceDisplay}</span>
          {!canPayWithWallet && !isEmployee ? (
            <>
              {" "}
              —{" "}
              <Link
                href="/company-portal/money"
                className="font-semibold text-[#0097B2] hover:underline"
              >
                Top up wallet
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {!isEmployee ? (
        <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="invoicePaymentMethod"
              value="wallet"
              checked={paymentMethod === "wallet"}
              onChange={() => setPaymentMethod("wallet")}
              className="accent-[#0097B2]"
            />
            <span className="font-medium text-[#0F172A]">Pay with wallet</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="invoicePaymentMethod"
              value="stripe"
              checked={paymentMethod === "stripe"}
              onChange={() => setPaymentMethod("stripe")}
              className="accent-[#0097B2]"
            />
            <span className="font-medium text-[#0F172A]">
              Pay with card (Stripe)
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-3 text-[12px] font-medium text-[#0F172A]">
          Payment method: Employee wallet only
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {paymentLinks.map((link) => {
          const dueAmount = Number(link.due || 0);
          const walletTooLow =
            activePaymentMethod === "wallet" &&
            walletBalance != null &&
            Number(walletBalance) < dueAmount;
          const isPaying = payingType === link.type;

          return (
            <li
              key={`${link.type}-${link.invoiceNumber || link.label}`}
              className="rounded-[8px] border border-[#E0F2FE] bg-white px-3 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-[#0F172A]">
                    {link.label}
                    {link.invoiceNumber ? ` (${link.invoiceNumber})` : ""}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    Due: {link.dueDisplay || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePay(link)}
                  disabled={isPaying || walletTooLow}
                  className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPaying
                    ? "Processing..."
                    : activePaymentMethod === "wallet"
                      ? "Pay from wallet"
                      : "Pay with card"}
                </button>
              </div>
              {walletTooLow ? (
                <p className="mt-2 text-[11px] text-[#B45309]">
                  {isEmployee
                    ? "Insufficient wallet balance for this invoice. Ask your company to allocate more funds to your account."
                    : "Insufficient wallet balance for this invoice. Top up or pay by card."}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mt-3 text-[12px] text-red-600">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 text-[12px] font-medium text-[#059669]">{success}</p>
      ) : null}
    </div>
  );
}
