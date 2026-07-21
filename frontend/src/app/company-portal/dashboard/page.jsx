"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyPortalQuickActions from "@/components/company-portal/CompanyPortalQuickActions";
import CompanyPortalRecentOrders from "@/components/company-portal/CompanyPortalRecentOrders";
import CompanyPortalStatCard from "@/components/company-portal/CompanyPortalStatCard";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import {
  clearCompanyAuth,
  isCompanyAuthenticated,
} from "@/lib/company-portal/companyPortalAuthStorage";
import {
  getCompanyPortalDashboard,
  listCompanyPortalOrders,
} from "@/lib/company-portal/companyPortalOrderApi";
import { mapDashboardOrderRow } from "@/lib/company-portal/companyPortalOrderStatus";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import {
  hasHtmlMarkup,
  htmlMarkupError,
  sanitizeTrackOrderInput,
} from "@/lib/company-portal/companyPortalValidation";

const EMPTY_STATS = {
  totalOrders: 0,
  inProcess: 0,
  invoice: 0,
  paid: 0,
  released: 0,
};

const ORDERS_PAGE_SIZE = 10;

export default function CompanyPortalDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackInput, setTrackInput] = useState("");
  const [trackError, setTrackError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const requestIdRef = useRef(0);

  const loadOrdersPage = useCallback(async (page = 1, cursor = null) => {
    const requestId = (requestIdRef.current += 1);
    setOrdersLoading(true);

    try {
      const response = await listCompanyPortalOrders({
        pagination: "keyset",
        cursor,
        pageSize: ORDERS_PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      const data = response?.data || {};
      const pagination = data.pagination || {};
      setRecentOrders((data.orders || []).map(mapDashboardOrderRow));
      setHasMore(Boolean(pagination.hasMore));
      setNextCursor(pagination.nextCursor || null);
      setCurrentPage(page);
      setCursorHistory((prev) => {
        const next = prev.slice(0, page - 1);
        next[page - 1] = cursor;
        if (pagination.hasMore && pagination.nextCursor) {
          next[page] = pagination.nextCursor;
        }
        return next;
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setRecentOrders([]);
      setHasMore(false);
      setNextCursor(null);
      setError(getApiErrorMessage(err, "Unable to load orders"));
    } finally {
      if (requestId === requestIdRef.current) {
        setOrdersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!isCompanyAuthenticated()) {
        router.replace("/company-portal/login");
        return;
      }

      try {
        const [userResponse, dashboardResponse] = await Promise.all([
          getCompanyCurrentUser(),
          getCompanyPortalDashboard(),
        ]);

        if (!active) return;
        setUser(userResponse?.data?.user || null);
        setStats(dashboardResponse?.data?.stats || EMPTY_STATS);
        setError("");
        await loadOrdersPage(1, null);
      } catch (err) {
        if (!active) return;
        clearCompanyAuth();
        setError(getApiErrorMessage(err, "Unable to load dashboard"));
        router.replace("/company-portal/login");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [router, loadOrdersPage]);

  const summaryCards = useMemo(() => {
    const cards = [
      {
        label: "Total orders",
        value: stats.totalOrders,
        hint: "Paid and placed requests",
        icon: <OrdersIcon />,
        iconBg: "#E6F7FA",
        iconColor: "#0097B2",
      },
      {
        label: "In Process",
        value: stats.inProcess,
        hint: "Being verified and processed",
        icon: <PendingIcon />,
        iconBg: "#FFF7ED",
        iconColor: "#EA580C",
      },
      {
        label: "Invoice",
        value: stats.invoice,
        hint: "Invoice stage",
        icon: <InvoiceIcon />,
        iconBg: "#FEF3C7",
        iconColor: "#D97706",
      },
      {
        label: "Paid",
        value: stats.paid,
        hint: "Facility payment completed",
        icon: <PaidIcon />,
        iconBg: "#EFF6FF",
        iconColor: "#2563EB",
      },
      {
        label: "Released",
        value: stats.released,
        hint: "Documents ready to download",
        icon: <ReleasedIcon />,
        iconBg: "#ECFDF5",
        iconColor: "#059669",
      },
    ];

    if (user?.isAdmin === false) {
      const balance = Number(user.walletBalance || 0);
      cards.unshift({
        label: "My wallet",
        value: `$${balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        hint: "Allocated by your company",
        icon: <WalletIcon />,
        iconBg: "#F5F3FF",
        iconColor: "#7C3AED",
      });
    }

    return cards;
  }, [stats, user]);

  const handleTrack = (event) => {
    event.preventDefault();
    if (hasHtmlMarkup(trackInput)) {
      setTrackError(htmlMarkupError("orderNumber"));
      return;
    }
    const value = sanitizeTrackOrderInput(trackInput);
    if (!value) {
      setTrackError("Enter the order number from your confirmation.");
      return;
    }
    setTrackError("");
    router.push(
      `/company-portal/orders/track/${encodeURIComponent(value)}`
    );
  };

  const handleAction = (actionId) => {
    if (actionId === "create-order") {
      router.push("/company-portal/orders/new");
      return;
    }
    if (actionId === "placed-orders" || actionId === "track-order") {
      router.push("/company-portal/orders/track");
      return;
    }
    if (actionId === "edit-profile") {
      router.push("/company-portal/profile");
    }
  };

  const handlePreviousPage = () => {
    if (currentPage <= 1 || ordersLoading) return;
    const previousCursor = cursorHistory[currentPage - 2] ?? null;
    loadOrdersPage(currentPage - 1, previousCursor);
  };

  const handleNextPage = () => {
    if (!hasMore || ordersLoading || !nextCursor) return;
    loadOrdersPage(currentPage + 1, nextCursor);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        Loading dashboard...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-[13px] text-red-500">
        {error || "Unable to load dashboard"}
      </main>
    );
  }

  return (
    <CompanyPortalDashboardShell title="Dashboard">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
          Welcome back
          {user.isAdmin === false && user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          {user.isAdmin === false
            ? `Track your requests and place orders for ${user.companyName} using your allocated wallet balance.`
            : `Track requests and manage company portal orders for ${user.companyName}.`}
        </p>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          user.isAdmin === false ? "xl:grid-cols-3 2xl:grid-cols-6" : "xl:grid-cols-5"
        }`}
      >
        {summaryCards.map((card) => (
          <CompanyPortalStatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5 rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-[#111827]">
          Track an order
        </h2>
        <p className="mt-1 text-[12px] text-[#64748B]">
          Enter the order number you received after payment (for example
          ORD-123456).
        </p>
        <form
          onSubmit={handleTrack}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={trackInput}
              onChange={(event) => {
                setTrackInput(sanitizeTrackOrderInput(event.target.value));
                if (trackError) setTrackError("");
              }}
              placeholder="ORD-123456"
              className="h-11 w-full rounded-[8px] border border-[#E2E8F0] px-3 text-[13px] text-[#0F172A] outline-none focus:border-[#0097B2]"
            />
            {trackError ? (
              <p className="mt-1 text-[12px] text-red-600">{trackError}</p>
            ) : null}
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0097B2] px-5 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Track
          </button>
        </form>
      </div>

      <div className="mt-5">
        <CompanyPortalQuickActions
          onAction={handleAction}
          isEmployee={user.isAdmin === false}
        />
      </div>

      <div className="mt-5">
        <CompanyPortalRecentOrders
          orders={recentOrders}
          loading={ordersLoading}
          title="Your orders"
          subtitle="Browse your requests, 10 orders per page"
          onViewAll={() => router.push("/company-portal/orders/track")}
          onSelectOrder={(order) => {
            if (!order?.orderNumber) return;
            router.push(
              `/company-portal/orders/track/${encodeURIComponent(
                order.orderNumber
              )}`
            );
          }}
          currentPage={currentPage}
          hasMore={hasMore}
          pageSize={ORDERS_PAGE_SIZE}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      </div>
    </CompanyPortalDashboardShell>
  );
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h8M8 12h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h10v18l-2-1.2L13 21l-2-1.2L9 21l-2-1.2V3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReleasedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 12.5 11 15l4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
