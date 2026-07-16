/**
 * Primary load scenario — Orders read paths under ramp-up load.
 *
 * Usage:
 *   k6 run load-tests/k6/orders-read.js
 *   k6 run -e BASE_URL=http://127.0.0.1:5000 load-tests/k6/orders-read.js
 */

import { check, sleep } from "k6";
import {
  loginAndGetToken,
  getJson,
  refreshAccessToken,
} from "./auth.js";

const TARGET_P95_MS = Number(__ENV.P95_MS || 1500);

export const options = {
  scenarios: {
    orders_read: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Number(__ENV.VU_STAGE1 || 10) },
        { duration: "1m", target: Number(__ENV.VU_STAGE2 || 50) },
        { duration: "2m", target: Number(__ENV.VU_STAGE3 || 100) },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:orders_list}": [`p(95)<${TARGET_P95_MS}`],
    http_req_duration: [`p(95)<${TARGET_P95_MS * 2}`],
  },
};

export function setup() {
  const auth = loginAndGetToken();
  const list = getJson(
    `${auth.baseUrl}/api/orders?pagination=keyset&pageSize=50`,
    auth.accessToken,
    "orders_list_setup"
  );

  let orderIds = [];
  let facilityId = "";
  try {
    const body = list.json();
      const orders = body?.data?.orders || [];
      const pagination = body?.data?.pagination || {};
      if (Array.isArray(orders)) {
        orderIds = orders.map((o) => o.dbId || o.id).filter(Boolean);
        facilityId = String(orders[0]?.facilityId || orders[0]?.facility || "");
      }
      // keep pagination nextCursor discovery in default fn
      void pagination;
  } catch (_error) {
    // keep empty sample ids
  }

  return { ...auth, orderIds, facilityId, issuedAt: Date.now() };
}

export default function (data) {
  let token = data.accessToken;
  const { baseUrl, orderIds, facilityId, refreshToken } = data;

  // Refresh every ~10 minutes of VU runtime if token aging (setup token shared)
  if (refreshToken && Date.now() - data.issuedAt > 10 * 60 * 1000) {
    const next = refreshAccessToken(refreshToken);
    if (next) token = next;
  }

  const list = getJson(
    `${baseUrl}/api/orders?pagination=keyset&pageSize=10`,
    token,
    "orders_list"
  );
  check(list, { "orders list ok": (r) => r.status === 200 });

  let cursor = "";
  try {
    cursor = list.json()?.data?.pagination?.nextCursor || "";
  } catch (_error) {
    cursor = "";
  }

  if (cursor) {
    const page2 = getJson(
      `${baseUrl}/api/orders?pagination=keyset&pageSize=10&cursor=${encodeURIComponent(cursor)}`,
      token,
      "orders_list_cursor"
    );
    check(page2, { "orders cursor ok": (r) => r.status === 200 });
  }

  const stats = getJson(`${baseUrl}/api/orders/stats`, token, "orders_stats");
  check(stats, { "stats ok": (r) => r.status === 200 });

  const companies = getJson(
    `${baseUrl}/api/orders/companies`,
    token,
    "orders_companies"
  );
  check(companies, { "companies ok": (r) => r.status === 200 });

  const facilities = getJson(`${baseUrl}/api/facilities`, token, "facilities");
  check(facilities, { "facilities ok": (r) => r.status === 200 });

  const search = getJson(
    `${baseUrl}/api/orders?pagination=keyset&pageSize=10&search=LT-`,
    token,
    "orders_search"
  );
  check(search, { "search ok": (r) => r.status === 200 });

  if (facilityId) {
    const byFacility = getJson(
      `${baseUrl}/api/orders?pagination=keyset&pageSize=10&facility=${encodeURIComponent(facilityId)}`,
      token,
      "orders_facility_filter"
    );
    check(byFacility, { "facility filter ok": (r) => r.status === 200 });
  }

  const year = new Date().getFullYear();
  const byYear = getJson(
    `${baseUrl}/api/orders?pagination=keyset&pageSize=10&year=${year}`,
    token,
    "orders_year_filter"
  );
  check(byYear, { "year filter ok": (r) => r.status === 200 });

  if (orderIds.length) {
    const id = orderIds[Math.floor(Math.random() * orderIds.length)];
    const detail = getJson(`${baseUrl}/api/orders/${id}`, token, "orders_detail");
    check(detail, { "detail ok": (r) => r.status === 200 });
  }

  sleep(Number(__ENV.THINK_TIME || 0.5));
}
