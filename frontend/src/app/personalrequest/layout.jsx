export const metadata = {
  title: "Personal Request Portal | DMS",
  description: "External personal request portal for Document Management Services.",
};

/**
 * Visibility is controlled by PORTAL_NAVIGATION_HIDDEN in
 * portalNavigationVisibility.js + middleware (download/pay routes stay allowed).
 */
export default function PersonalRequestLayout({ children }) {
  return children;
}
