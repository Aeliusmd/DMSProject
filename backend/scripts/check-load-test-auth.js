/**
 * Quick sanity check for load-test login (devOtp).
 * Usage: node scripts/check-load-test-auth.js
 */
require("dotenv").config();

async function main() {
  const base = `http://127.0.0.1:${process.env.PORT || 5000}`;
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "loadtest",
      password: "LoadTest@123",
    }),
  });
  const login = await loginRes.json();
  console.log("login status", loginRes.status);
  console.log("hasDevOtp", Boolean(login?.data?.devOtp));
  console.log("loadTestMode env", process.env.LOAD_TEST_MODE);

  if (!login?.data?.sessionToken || !login?.data?.devOtp) {
    console.log("body keys", Object.keys(login?.data || {}));
    process.exit(1);
  }

  const verifyRes = await fetch(`${base}/api/auth/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: login.data.sessionToken,
      code: String(login.data.devOtp),
      trustDevice: true,
    }),
  });
  const verify = await verifyRes.json();
  console.log("verify status", verifyRes.status);
  console.log("hasAccessToken", Boolean(verify?.data?.accessToken));

  if (!verify?.data?.accessToken) process.exit(1);

  const ordersRes = await fetch(
    `${base}/api/orders?pagination=keyset&pageSize=10`,
    { headers: { Authorization: `Bearer ${verify.data.accessToken}` } }
  );
  const orders = await ordersRes.json();
  console.log("orders status", ordersRes.status);
  console.log(
    "orderCount",
    (orders?.data?.orders || []).length,
    "nextCursor",
    Boolean(orders?.data?.pagination?.nextCursor)
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
