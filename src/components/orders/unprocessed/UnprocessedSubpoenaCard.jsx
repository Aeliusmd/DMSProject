import Link from "next/link";
import PdfThumbnail from "@/components/orders/unprocessed/PdfThumbnail";

export default function UnprocessedSubpoenaCard({
  subpoena,
  isSelected,
  onPreview,
}) {
  return (
    <article
      className={`flex gap-4 border-b border-[#F1F5F9] px-4 py-4 transition hover:bg-[#F8FAFC] sm:px-6 ${
        isSelected ? "bg-[#F8FAFC]" : "bg-white"
      }`}
    >
      <div className="shrink-0">
        <PdfThumbnail fileName={subpoena.fileName} />
        <p className="mt-2 text-center text-[10px] text-[#94A3B8]">
          {subpoena.uploadedAt}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h2 className="truncate text-[13px] font-semibold text-[#111827] sm:text-[14px]">
          {subpoena.fileName}
        </h2>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="flex w-fit items-center gap-2 text-[12px] font-medium text-[#0097B2] hover:underline"
          >
            <ReviewIcon />
            Review
          </button>

          <Link
            href={`/orders/new?subpoenaId=${subpoena.id}`}
            className="flex w-fit items-center gap-2 text-[12px] font-medium text-[#0097B2] hover:underline"
          >
            <CreateIcon />
            Create New Order w/ Subpoena
          </Link>
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 text-[11px] text-[#94A3B8] md:flex">
        <span>{subpoena.pages} pages</span>
        <span>{subpoena.size}</span>
      </div>
    </article>
  );
}

function ReviewIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}