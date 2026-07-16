/**
 * Smoke test — 1 VU for 1 minute.
 * Usage: k6 run load-tests/k6/smoke.js
 */

import { check, sleep } from "k6";
import { loginAndGetToken, getJson } from "./auth.js";

export const options = {
  vus: 1,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

export function setup() {
  return loginAndGetToken();
}

export default function (data) {
  const { accessToken, baseUrl } = data;

  const list = getJson(
    `${baseUrl}/api/orders?pagination=keyset&pageSize=10`,
    accessToken,
    "orders_list"
  );
  check(list, { "orders list 200": (r) => r.status === 200 });

  const stats = getJson(`${baseUrl}/api/orders/stats`, accessToken, "orders_stats");
  check(stats, { "stats 200": (r) => r.status === 200 });

  sleep(1);
}
