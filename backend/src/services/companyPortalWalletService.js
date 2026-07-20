const Stripe = require("stripe");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const { getPool } = require("../config/database");
const CompanyPortalEmployee = require("../models/CompanyPortalEmployee");
const CompanyPortalWallet = require("../models/CompanyPortalWallet");
const CompanyPortalWalletTopup = require("../models/CompanyPortalWalletTopup");
const CompanyPortalWalletTransaction = require("../models/CompanyPortalWalletTransaction");

const MIN_TOPUP_AMOUNT = 10;
const MAX_TOPUP_AMOUNT = 10000;
const COMPANY_PORTAL_ORDER_FEE = 15;

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    const secretKey = config.stripe?.secretKey;
    if (!secretKey) {
      throw new ApiError(500, "Stripe is not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function getAvailableOrderBalance(companyUserId, employeeId = null) {
  if (employeeId) {
    const employee = await CompanyPortalEmployee.findByIdForCompany(
      employeeId,
      companyUserId
    );

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    return {
      amount: toMoney(employee.wallet_balance || 0),
      source: "employee",
    };
  }

  await CompanyPortalWallet.ensureForCompany(companyUserId);
  const wallet = await CompanyPortalWallet.findByCompanyUserId(companyUserId);
  return {
    amount: toMoney(wallet?.unallocated_balance || 0),
    source: "company",
  };
}

async function assertSufficientBalance(
  companyUserId,
  employeeId = null,
  requiredAmount
) {
  const amount = toMoney(requiredAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than zero");
  }

  const balance = await getAvailableOrderBalance(companyUserId, employeeId);

  if (balance.amount < amount) {
    const ownerLabel =
      balance.source === "employee" ? "employee wallet" : "company wallet";
    throw new ApiError(
      400,
      `Your ${ownerLabel} balance is too low for this payment.`,
      [
        {
          field: "walletBalance",
          message: `Available balance is $${balance.amount.toFixed(
            2
          )}. At least $${amount.toFixed(2)} is required.`,
        },
      ]
    );
  }

  return balance;
}

async function assertSufficientOrderBalance(
  companyUserId,
  employeeId = null,
  requiredAmount = COMPANY_PORTAL_ORDER_FEE
) {
  return assertSufficientBalance(companyUserId, employeeId, requiredAmount);
}

function formatTransaction(row) {
  return {
    id: row.id,
    type: row.transaction_type,
    amount: toMoney(row.amount),
    companyBalanceAfter: toMoney(row.company_balance_after),
    employeeBalanceAfter:
      row.employee_balance_after == null
        ? null
        : toMoney(row.employee_balance_after),
    employeeName: row.employee_name || null,
    description: row.description || "",
    orderId: row.order_id || null,
    createdAt: row.created_at,
  };
}

async function getWalletSummary(companyUserId) {
  await CompanyPortalWallet.ensureForCompany(companyUserId);
  const wallet = await CompanyPortalWallet.findByCompanyUserId(companyUserId);
  const allocatedTotal = await CompanyPortalEmployee.getAllocatedTotal(
    companyUserId
  );
  const unallocatedBalance = toMoney(wallet?.unallocated_balance || 0);
  const allocatedBalance = toMoney(allocatedTotal);
  const totalBalance = toMoney(unallocatedBalance + allocatedBalance);

  // First page only — use listWalletTransactions for full keyset browsing.
  const txPage = await CompanyPortalWalletTransaction.listForCompanyKeyset(
    companyUserId,
    { pageSize: 10 }
  );

  return {
    unallocatedBalance,
    allocatedBalance,
    totalBalance,
    currency: (config.stripe.currency || "usd").toUpperCase(),
    transactions: txPage.rows.map(formatTransaction),
    transactionPagination: {
      type: "keyset",
      pageSize: txPage.pageSize,
      hasMore: txPage.hasMore,
      nextCursor: txPage.nextCursor,
    },
  };
}

async function listWalletTransactions(
  companyUserId,
  { cursor = null, pageSize = 10 } = {}
) {
  await CompanyPortalWallet.ensureForCompany(companyUserId);
  const txPage = await CompanyPortalWalletTransaction.listForCompanyKeyset(
    companyUserId,
    { cursor, pageSize }
  );

  return {
    transactions: txPage.rows.map(formatTransaction),
    pagination: {
      type: "keyset",
      pageSize: txPage.pageSize,
      hasMore: txPage.hasMore,
      nextCursor: txPage.nextCursor,
    },
  };
}

async function createTopupCheckout(companyUserId, { amount }) {
  const numericAmount = toMoney(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < MIN_TOPUP_AMOUNT) {
    throw new ApiError(400, `Minimum top-up amount is $${MIN_TOPUP_AMOUNT}`, [
      {
        field: "amount",
        message: `Minimum top-up amount is $${MIN_TOPUP_AMOUNT}`,
      },
    ]);
  }

  if (numericAmount > MAX_TOPUP_AMOUNT) {
    throw new ApiError(400, `Maximum top-up amount is $${MAX_TOPUP_AMOUNT}`, [
      {
        field: "amount",
        message: `Maximum top-up amount is $${MAX_TOPUP_AMOUNT}`,
      },
    ]);
  }

  const stripe = getStripe();
  const amountCents = Math.round(numericAmount * 100);
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  const pending = await CompanyPortalWalletTopup.createPending({
    companyUserId,
    amount: numericAmount,
  });

  const successUrl = `${baseClient}/company-portal/money?topup=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/company-portal/money?topup=canceled`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: config.stripe.currency || "usd",
          product_data: {
            name: "Company Portal Wallet Top-up",
            description: "Add funds to your company wallet",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      portal: "company_wallet",
      company_user_id: String(companyUserId),
      topup_id: String(pending.id),
      amount: String(numericAmount),
      currency: config.stripe.currency || "usd",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await CompanyPortalWalletTopup.attachSessionId(pending.id, session.id);

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    amount: numericAmount,
  };
}

async function fulfillWalletTopupSession(session) {
  if (session?.metadata?.portal !== "company_wallet") {
    return null;
  }

  if (session.payment_status !== "paid") {
    return null;
  }

  const topupId = Number(session.metadata?.topup_id);
  const companyUserId = Number(session.metadata?.company_user_id);
  const amount = toMoney(session.metadata?.amount);

  if (!topupId || !companyUserId || !amount) {
    return null;
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const topup = await CompanyPortalWalletTopup.findById(topupId, connection);
    if (!topup || topup.status === "paid") {
      await connection.commit();
      return topup;
    }

    const companyBalanceAfter = await CompanyPortalWallet.adjustUnallocatedBalance(
      companyUserId,
      amount,
      connection
    );

    await CompanyPortalWalletTransaction.create(
      {
        companyUserId,
        transactionType: "topup",
        amount,
        companyBalanceAfter,
        description: `Wallet top-up of $${amount.toFixed(2)}`,
        stripeCheckoutSessionId: session.id,
      },
      connection
    );

    await CompanyPortalWalletTopup.markPaid(topupId, connection);
    await connection.commit();

    return {
      companyUserId,
      amount,
      companyBalanceAfter,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function confirmTopup(companyUserId, sessionId) {
  if (!sessionId) {
    throw new ApiError(400, "session_id is required");
  }

  const existing = await CompanyPortalWalletTopup.findBySessionId(sessionId);
  if (
    existing &&
    existing.status === "paid" &&
    Number(existing.company_user_id) === Number(companyUserId)
  ) {
    return getWalletSummary(companyUserId);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.portal !== "company_wallet") {
    throw new ApiError(400, "Checkout session does not match wallet top-up");
  }

  if (
    String(session.metadata?.company_user_id || "") !== String(companyUserId)
  ) {
    throw new ApiError(403, "Checkout session does not belong to this account");
  }

  if (session.payment_status !== "paid") {
    throw new ApiError(400, "Payment has not been completed yet");
  }

  await fulfillWalletTopupSession(session);
  return getWalletSummary(companyUserId);
}

async function allocateToEmployee(companyUserId, { employeeId, amount }) {
  const numericAmount = toMoney(amount);

  if (!employeeId) {
    throw new ApiError(400, "Employee is required", [
      { field: "employeeId", message: "Employee is required" },
    ]);
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, "Allocation amount must be greater than zero", [
      { field: "amount", message: "Allocation amount must be greater than zero" },
    ]);
  }

  const employee = await CompanyPortalEmployee.findByIdForCompany(
    employeeId,
    companyUserId
  );

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const wallet = await CompanyPortalWallet.ensureForCompany(
      companyUserId,
      connection
    );
    const unallocated = toMoney(wallet.unallocated_balance);

    if (unallocated < numericAmount) {
      throw new ApiError(400, "Insufficient unallocated balance", [
        {
          field: "amount",
          message: `Only $${unallocated.toFixed(2)} is available to allocate`,
        },
      ]);
    }

    const companyBalanceAfter = await CompanyPortalWallet.adjustUnallocatedBalance(
      companyUserId,
      -numericAmount,
      connection
    );
    const employeeBalanceAfter = await CompanyPortalEmployee.adjustWalletBalance(
      employee.id,
      numericAmount,
      connection
    );

    await CompanyPortalWalletTransaction.create(
      {
        companyUserId,
        employeeId: employee.id,
        transactionType: "allocation",
        amount: numericAmount,
        companyBalanceAfter,
        employeeBalanceAfter,
        description: `Allocated $${numericAmount.toFixed(2)} to ${employee.name}`,
      },
      connection
    );

    await connection.commit();

    return getWalletSummary(companyUserId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function debitForOrder(
  {
    companyUserId,
    employeeId = null,
    amount,
    orderId,
    description,
  },
  connection = null
) {
  const numericAmount = toMoney(amount);
  const pool = connection || getPool();
  const ownsConnection = !connection;
  const conn = ownsConnection ? await pool.getConnection() : connection;

  try {
    if (ownsConnection) {
      await conn.beginTransaction();
    }

    let companyBalanceAfter = null;
    let employeeBalanceAfter = null;

    if (employeeId) {
      const employee = await CompanyPortalEmployee.findByIdForCompany(
        employeeId,
        companyUserId,
        conn
      );

      if (!employee) {
        throw new ApiError(404, "Employee not found");
      }

      if (toMoney(employee.wallet_balance) < numericAmount) {
        throw new ApiError(400, "Insufficient employee wallet balance", [
          {
            field: "paymentMethod",
            message: "Employee wallet balance is too low for this order",
          },
        ]);
      }

      employeeBalanceAfter = await CompanyPortalEmployee.adjustWalletBalance(
        employeeId,
        -numericAmount,
        conn
      );
    } else {
      const wallet = await CompanyPortalWallet.ensureForCompany(
        companyUserId,
        conn
      );

      if (toMoney(wallet.unallocated_balance) < numericAmount) {
        throw new ApiError(400, "Insufficient company wallet balance", [
          {
            field: "paymentMethod",
            message:
              "Company wallet balance is too low. Top up or use card payment.",
          },
        ]);
      }

      companyBalanceAfter = await CompanyPortalWallet.adjustUnallocatedBalance(
        companyUserId,
        -numericAmount,
        conn
      );
    }

    const transactionId = await CompanyPortalWalletTransaction.create(
      {
        companyUserId,
        employeeId,
        transactionType: "order_payment",
        amount: numericAmount,
        companyBalanceAfter,
        employeeBalanceAfter,
        description: description || `Order payment of $${numericAmount.toFixed(2)}`,
        orderId,
      },
      conn
    );

    if (ownsConnection) {
      await conn.commit();
    }

    return { transactionId, companyBalanceAfter, employeeBalanceAfter };
  } catch (error) {
    if (ownsConnection) {
      await conn.rollback();
    }
    throw error;
  } finally {
    if (ownsConnection) {
      conn.release();
    }
  }
}

module.exports = {
  getWalletSummary,
  listWalletTransactions,
  getAvailableOrderBalance,
  assertSufficientBalance,
  assertSufficientOrderBalance,
  createTopupCheckout,
  fulfillWalletTopupSession,
  confirmTopup,
  allocateToEmployee,
  debitForOrder,
  toMoney,
};
