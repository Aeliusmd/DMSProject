import { API_BASE_URL } from "@/config/api";

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.message || "Request failed");
  }

  return body?.data ?? body;
}

export async function fetchPaymentPage(token) {
  const response = await fetch(
    `${API_BASE_URL}/public/pay/${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  return parseResponse(response);
}

export async function startCheckout(token, invoiceType) {
  const response = await fetch(
    `${API_BASE_URL}/public/pay/${encodeURIComponent(token)}/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceType }),
    }
  );
  return parseResponse(response);
}

export async function fetchCheckoutResult(token, sessionId) {
  const params = new URLSearchParams();
  params.set("session_id", sessionId);

  const response = await fetch(
    `${API_BASE_URL}/public/pay/${encodeURIComponent(token)}/result?${params.toString()}`,
    { cache: "no-store" }
  );
  return parseResponse(response);
}

export function getReceiptDownloadUrl(sessionId, token) {
  const params = new URLSearchParams();
  params.set("token", token);
  return `${API_BASE_URL}/public/pay/receipt/${encodeURIComponent(sessionId)}?${params.toString()}`;
}
