import type { NextConfig } from "next";

function getApiOrigin() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

  try {
    return new URL(apiBase).origin;
  } catch {
    return "http://localhost:5000";
  }
}

function buildContentSecurityPolicy(isDev: boolean) {
  const apiOrigin = getApiOrigin();

  // Next.js injects inline bootstrap scripts/styles. Dev also needs unsafe-eval for HMR.
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://checkout.stripe.com https://hooks.stripe.com",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${apiOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    `frame-src 'self' blob: ${apiOrigin}`,
    "worker-src 'self' blob:",
    `media-src 'self' blob: ${apiOrigin}`,
  ];

  if (!isDev && process.env.CSP_UPGRADE_INSECURE_REQUESTS === "true") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const isDev = process.env.NODE_ENV !== "production";
const cspHeaderName =
  process.env.CSP_REPORT_ONLY === "true"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
const cspValue = buildContentSecurityPolicy(isDev);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: cspHeaderName, value: cspValue },
        ],
      },
    ];
  },
};

export default nextConfig;
