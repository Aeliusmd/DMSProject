"use client";

export default function CompanyEmployeeInsufficientWalletModal({
  open,
  balance = 0,
  requiredAmount = 15,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-wallet-modal-title"
        className="w-full max-w-[420px] rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-xl"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#FFF7ED] text-[#EA580C]">
          <WalletWarningIcon />
        </div>

        <h2
          id="employee-wallet-modal-title"
          className="mt-4 text-[18px] font-semibold text-[#0F172A]"
        >
          Wallet balance is not enough
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
          You need at least ${Number(requiredAmount).toFixed(2)} in your
          allocated wallet to create an order. Your current balance is $
          {Number(balance || 0).toFixed(2)}.
        </p>
        <p className="mt-3 rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-[12px] text-[#9A3412]">
          Please wait for your company to top up and allocate funds to your
          account. Employees cannot top up the wallet themselves.
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function WalletWarningIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
