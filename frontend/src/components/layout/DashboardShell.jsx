"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import DailyReminderPopup from "@/components/notifications/DailyReminderPopup";

/**
 * @param {{ children: import("react").ReactNode, lockScroll?: boolean }} props
 * lockScroll: New/Edit Order — only card panels scroll, never the page.
 */
export default function DashboardShell({ children, lockScroll = false }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden text-[#111827]"
      style={{ background: "#F8FAFC" }}
    >
      <DailyReminderPopup />
      <Sidebar isCollapsed={isSidebarCollapsed} />

      <div
        className={`flex h-full min-w-0 flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "pl-[72px]" : "pl-[190px]"
        } max-md:!pl-[72px]`}
      >
        <Topbar onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)} />

        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 lg:px-6"
          style={{ background: "#F8FAFC" }}
        >
          <div
            className={`mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col ${
              lockScroll
                ? "overflow-hidden"
                : "overflow-x-hidden overflow-y-auto"
            }`}
            style={{ background: "#F8FAFC" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
