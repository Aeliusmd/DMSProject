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

  return children;
}
