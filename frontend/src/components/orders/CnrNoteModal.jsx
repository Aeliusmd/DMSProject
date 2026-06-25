"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";

export default function CnrNoteModal({ isOpen, title, note, onClose }) {
  const mounted = useIsClient();

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[520px] rounded-[10px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-[18px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="whitespace-pre-wrap text-[13px] leading-[20px] text-[#334155]">
            {note?.trim() ? note : "No note provided."}
          </p>
        </div>
      </section>
    </div>,
    document.body
  );
}
