"use client";

export default function SubpoenaExtractionOverlay({ open = false }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-[3px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="subpoena-extraction-title"
      aria-describedby="subpoena-extraction-desc"
    >
      <div className="w-full max-w-[380px] rounded-[12px] border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E6F7FA]">
          <div className="relative h-10 w-10">
            <span className="absolute inset-0 rounded-full border-[3px] border-[#B8E8EF]" />
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#0097B2]" />
            <span className="absolute inset-[10px] flex items-center justify-center rounded-full bg-[#E6F7FA] text-[10px] font-bold tracking-wide text-[#007F96]">
              AI
            </span>
          </div>
        </div>

        <h2
          id="subpoena-extraction-title"
          className="text-[16px] font-semibold text-[#111827]"
        >
          AI Processing Subpoena
        </h2>

        <p
          id="subpoena-extraction-desc"
          className="mt-2 text-[13px] leading-relaxed text-[#64748B]"
        >
          Reading your document and extracting order fields. This may take a
          minute.
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0097B2] [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0097B2] [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0097B2] [animation-delay:400ms]" />
        </div>

        <p className="mt-4 text-[11px] font-medium text-[#94A3B8]">
          Please keep this page open
        </p>
      </div>
    </div>
  );
}
