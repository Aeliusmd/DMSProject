"use client";

import { getStoredUser, isImpersonating } from "@/lib/auth/authStorage";

export default function ImpersonationBanner() {
  if (!isImpersonating()) return null;

  const user = getStoredUser();
  const targetName = user?.name || "this user";
  const adminName = user?.impersonatedBy?.name;

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-center text-[12px] font-medium text-[#92400E]">
      Viewing as {targetName}
      {adminName ? ` (signed in by ${adminName})` : ""}. Use Exit user session
      when finished.
    </div>
  );
}
