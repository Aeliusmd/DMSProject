import { Fraunces, Manrope } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

export const metadata = {
  title: "DMS Portals | Document Management Services",
  description:
    "Access the Company Portal or Personal Request Portal to create an account and place orders with Document Management Services.",
};

export default function LandingPageLayout({ children }) {
  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{
        fontFamily: "var(--font-landing-body), sans-serif",
      }}
    >
      {children}
    </div>
  );
}
