import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  PORTAL_NAVIGATION_HIDDEN,
  PORTAL_ROUTE_REDIRECT,
} from "@/lib/portalNavigationVisibility";

export const metadata = {
  title: "Company Portal | DMS",
  description: "External company portal for Document Management Services.",
};

export default function CompanyPortalLayout({ children }) {
  if (PORTAL_NAVIGATION_HIDDEN) {
    redirect(PORTAL_ROUTE_REDIRECT);
  }

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
