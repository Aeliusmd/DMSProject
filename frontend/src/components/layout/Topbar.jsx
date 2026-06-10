"use client";

export default function Topbar({ onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2 sm:gap-3 sm:px-[18px]">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] text-[#0097B2] hover:bg-[#E6F7FA]"
      >
        <MenuIcon />
      </button>

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-[18px]">
        <button
          type="button"
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#F8FAFC]"
        >
          <BellIcon />
          <span className="absolute right-[7px] top-[6px] h-[6px] w-[6px] rounded-full bg-[#EF4444]" />
        </button>

        <button
          type="button"
          className="flex shrink-0 items-center gap-[7px] rounded-[6px] px-1 py-1 hover:bg-[#F8FAFC] sm:gap-[9px]"
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#BDECF3] text-[11px] font-medium text-[#007F96]">
            JD
          </div>

          <p className="hidden text-[13px] font-medium text-[#111827] sm:block">
            John Doe
          </p>
        </button>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}