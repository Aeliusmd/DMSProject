"use client";

import DashboardShell from "@/components/layout/DashboardShell";
import OrderStatsGrid from "@/components/orders/OrderStatsGrid";
import OrderActionButton from "@/components/orders/OrderActionButton";
import OrderFilterBar from "@/components/orders/OrderFilterBar";
import OrdersTable from "@/components/orders/OrdersTable";
import { useState } from "react";
import ReminderNotesModal from "@/components/orders/reminders/ReminderNotesModal";

export default function OrdersPage() {
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);


  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-[#111827] sm:text-[20px]">
            Orders
          </h1>
          <p className="mt-[4px] text-[13px] text-[#64748B]">
            Overview of your legal practice orders and cases
          </p>
        </div>

        <OrderStatsGrid />

        <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-[13px] font-semibold text-[#111827]">
            Quick Actions
          </h2>

          <div className="flex flex-wrap gap-3">
            <OrderActionButton href="/orders/new" variant="primary" icon={<PlusIcon />}>
               New Order
            </OrderActionButton>

            <OrderActionButton href="/orders/unprocessed" icon={<DocumentIcon />}>
               Unprocessed
            </OrderActionButton>

            <OrderActionButton icon={<BatchIcon />}>
              Batch Scan
            </OrderActionButton>

           <OrderActionButton
                icon={<ReminderIcon />}
                onClick={() => setIsReminderModalOpen(true)}
            >
              Reminder
            </OrderActionButton>
          </div>
        </section>

        <OrderFilterBar />

        <OrdersTable />
      </div>
      <ReminderNotesModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
      />
    </DashboardShell>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l3 3v15H6V3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BatchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M8 7h12v12H8V7Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 17V3h12" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ReminderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}