import { redirect } from "next/navigation";
import {
  PORTAL_NAVIGATION_HIDDEN,
  PORTAL_ROUTE_REDIRECT,
} from "@/lib/portalNavigationVisibility";

export const metadata = {
  title: "Company Registration | DMS Company Portal",
  description: "Register your company to place orders and upload subpoenas with DMS.",
};

export default function SubpoenaUploadLayout({ children }) {
  if (PORTAL_NAVIGATION_HIDDEN) {
    redirect(PORTAL_ROUTE_REDIRECT);
  }

  return children;
}
