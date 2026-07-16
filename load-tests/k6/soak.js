/**
 * Soak test — sustained moderate load for reliability over time.
 * Usage: k6 run load-tests/k6/soak.js
 */

import { check, sleep } from "k6";
import { loginAndGetToken, getJson } from "./auth.js";

export const options = {
  scenarios: {
    soak: {
      executor: "constant-vus",
      vus: Number(__ENV.SOAK_VUS || 25),
      duration: __ENV.SOAK_DURATION || "15m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2500"],
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
  check(list, { "list ok": (r) => r.status === 200 });

  const stats = getJson(`${baseUrl}/api/orders/stats`, accessToken, "orders_stats");
  check(stats, { "stats ok": (r) => r.status === 200 });

  sleep(1);
}
