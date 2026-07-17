import { PORTAL_NAVIGATION_HIDDEN } from "@/lib/portalNavigationVisibility";

export const metadata = {
  title: "Personal Request Portal | DMS",
  description: "External personal request portal for Document Management Services.",
};

export default function PersonalRequestLayout({ children }) {
  return (
    <div className={PORTAL_NAVIGATION_HIDDEN ? "portal-navigation-hidden" : ""}>
      {children}
    </div>
  );
}
