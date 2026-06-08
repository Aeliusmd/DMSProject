"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;
const BASE_PAGE_HEIGHT = 560;

export default function PdfPreviewDrawer({ subpoena, onClose }) {
  const [activePage, setActivePage] = useState(1);
  const [pageZooms, setPageZooms] = useState({});

  const scrollContainerRef = useRef(null);
  const pageRefs = useRef({});

  const previewPages = useMemo(() => {
    if (!subpoena) return [];
    return Array.from({ length: subpoena.pages }, (_, index) => index + 1);
  }, [subpoena]);

  useEffect(() => {
    if (!subpoena) return;

    setActivePage(1);
    setPageZooms({});
    pageRefs.current = {};

    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }, 0);
  }, [subpoena]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !subpoena) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const checkPoint = containerRect.top + containerRect.height * 0.35;

      let closestPage = 1;
      let smallestDistance = Infinity;

      previewPages.forEach((pageNumber) => {
        const pageElement = pageRefs.current[pageNumber];
        if (!pageElement) return;

        const pageRect = pageElement.getBoundingClientRect();
        const distance = Math.abs(pageRect.top - checkPoint);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestPage = pageNumber;
        }
      });

      setActivePage(closestPage);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [previewPages, subpoena]);

  if (!subpoena) return null;

  const activeZoom = pageZooms[activePage] || 1;

  const updateCurrentPageZoom = (direction) => {
    setPageZooms((prev) => {
      const currentZoom = prev[activePage] || 1;

      const nextZoom =
        direction === "in"
          ? Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP)
          : Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);

      return {
        ...prev,
        [activePage]: Number(nextZoom.toFixed(2)),
      };
    });
  };

  const goToPage = (pageNumber) => {
    const safePage = Math.min(Math.max(pageNumber, 1), subpoena.pages);

    pageRefs.current[safePage]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setActivePage(safePage);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button
        type="button"
        aria-label="Close preview overlay"
        onClick={onClose}
        className="hidden flex-1 lg:block"
      />

      <aside className="flex h-full w-full max-w-[720px] flex-col overflow-hidden bg-white shadow-xl sm:w-[720px]">
        <header className="flex min-h-[74px] shrink-0 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[7px] bg-[#DDF6FA] text-[#0097B2]">
              <PdfIcon />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-[#111827]">
                {subpoena.fileName}
              </h2>
              <p className="mt-[3px] text-[12px] text-[#94A3B8]">
                {subpoena.pages} pages
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-[#64748B]">
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 1}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            <p className="min-w-[58px] text-center text-[15px] font-medium text-[#334155]">
              {activePage} / {subpoena.pages}
            </p>

            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage === subpoena.pages}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>

            <button
              type="button"
              onClick={() => updateCurrentPageZoom("out")}
              disabled={activeZoom <= MIN_ZOOM}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom out current page"
            >
              <ZoomOutIcon />
            </button>

            <button
              type="button"
              onClick={() => updateCurrentPageZoom("in")}
              disabled={activeZoom >= MAX_ZOOM}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom in current page"
            >
              <ZoomInIcon />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] hover:bg-[#F1F5F9]"
              aria-label="Close preview"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto bg-[#F8FAFC] px-4 py-5"
        >
          <div className="space-y-6">
            {previewPages.map((pageNumber) => {
              const pageZoom = pageZooms[pageNumber] || 1;

              return (
                <div
                  key={pageNumber}
                  ref={(el) => {
                    pageRefs.current[pageNumber] = el;
                  }}
                  className="flex justify-center"
                  style={{
                    height: `${BASE_PAGE_HEIGHT * pageZoom}px`,
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${pageZoom})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <MockPdfPage
                      pageNumber={pageNumber}
                      totalPages={subpoena.pages}
                      fileName={subpoena.fileName}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function MockPdfPage({ pageNumber, totalPages, fileName }) {
  return (
    <div className="h-[560px] w-[420px] rounded-[4px] border border-[#CBD5E1] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="h-[10px] w-[120px] rounded bg-[#CBD5E1]" />
          <div className="mt-2 h-[8px] w-[170px] rounded bg-[#E2E8F0]" />
        </div>

        <div className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-500">
          PDF
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-[8px] w-full rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[88%] rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[94%] rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[76%] rounded bg-[#E2E8F0]" />
      </div>

      <div className="my-6 grid grid-cols-2 gap-4">
        <div className="h-[80px] rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
        <div className="h-[80px] rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
      </div>

      <div className="space-y-3">
        <div className="h-[8px] w-full rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[83%] rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[91%] rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[65%] rounded bg-[#E2E8F0]" />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="h-[54px] rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
        <div className="h-[54px] rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
        <div className="h-[54px] rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
      </div>

      <div className="mt-6 space-y-3">
        <div className="h-[8px] w-full rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[80%] rounded bg-[#E2E8F0]" />
        <div className="h-[8px] w-[92%] rounded bg-[#E2E8F0]" />
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-[11px] text-[#94A3B8]">
        <span className="max-w-[260px] truncate">{fileName}</span>
        <span className="shrink-0">
          Page {pageNumber} of {totalPages}
        </span>
      </div>
    </div>
  );
}

function PdfIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3h9l3 3v15H6V3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h4M9 16h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11h6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}