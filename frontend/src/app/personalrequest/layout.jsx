import { Suspense } from "react";

export const metadata = {
  title: "Personal Request Portal | DMS",
  description: "External personal request portal for Document Management Services.",
};

/**
 * Visibility is controlled by PORTAL_NAVIGATION_HIDDEN in
 * portalNavigationVisibility.js + middleware (download/pay routes stay allowed).
 */
export default function PersonalRequestLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
          <p className="text-[13px] text-[#64748B]">Loading...</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
