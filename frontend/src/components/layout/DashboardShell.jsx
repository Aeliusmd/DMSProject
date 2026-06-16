"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function DashboardShell({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <Sidebar isCollapsed={isSidebarCollapsed} />

      <div
        className={`min-h-screen min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? "pl-[72px]" : "pl-[190px]"
        } max-md:pl-[72px]`}
      >
        <Topbar onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)} />

        <main className="min-h-[calc(100vh-52px)] overflow-y-auto px-4 py-4 sm:px-5 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}