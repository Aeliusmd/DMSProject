/**
 * Shared k6 auth helpers for DMS load tests.
 * Requires LOAD_TEST_MODE=true so login returns devOtp.
 */

import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const IDENTIFIER = __ENV.LOAD_TEST_USER || "loadtest";
const PASSWORD = __ENV.LOAD_TEST_PASSWORD || "LoadTest@123";

export function loginAndGetToken() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      identifier: IDENTIFIER,
      password: PASSWORD,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "auth_login" },
    }
  );

  if (!check(loginRes, { "login status 200": (r) => r.status === 200 })) {
    fail(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const loginBody = loginRes.json();
  const sessionToken = loginBody?.data?.sessionToken || loginBody?.sessionToken;
  const devOtp = loginBody?.data?.devOtp || loginBody?.devOtp;

  if (!sessionToken || !devOtp) {
    fail(
      "Login missing sessionToken/devOtp. Set LOAD_TEST_MODE=true in backend .env and restart API."
    );
  }

  const verifyRes = http.post(
    `${BASE_URL}/api/auth/verify-2fa`,
    JSON.stringify({
      sessionToken,
      code: String(devOtp),
      trustDevice: true,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "auth_verify_2fa" },
    }
  );

  if (!check(verifyRes, { "verify-2fa status 200": (r) => r.status === 200 })) {
    fail(`2FA verify failed: ${verifyRes.status} ${verifyRes.body}`);
  }

  const verifyBody = verifyRes.json();
  const accessToken =
    verifyBody?.data?.accessToken || verifyBody?.accessToken;
  const refreshToken =
    verifyBody?.data?.refreshToken || verifyBody?.refreshToken;

  if (!accessToken) {
    fail("verify-2fa did not return accessToken");
  }

  return { accessToken, refreshToken, baseUrl: BASE_URL };
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

export function refreshAccessToken(refreshToken) {
  const res = http.post(
    `${BASE_URL}/api/auth/refresh`,
    JSON.stringify({ refreshToken }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "auth_refresh" },
    }
  );

  if (res.status !== 200) {
    return null;
  }

  const body = res.json();
  return body?.data?.accessToken || body?.accessToken || null;
}

export function getJson(url, token, tag) {
  return http.get(url, {
    headers: authHeaders(token),
    tags: { endpoint: tag },
  });
}
