import { SHEET_COMPANY_INFO } from "@/lib/sheetTemplateConstants";

export default function SheetLetterhead() {
  return (
    <>
      <p className="text-center text-[11px] italic text-[#6B7280]">
        &quot;{SHEET_COMPANY_INFO.tagline}&quot;
      </p>

      <div className="mt-5 flex justify-center">
        <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-[#111827] text-[20px] font-bold">
          {SHEET_COMPANY_INFO.logoText}
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[12px] font-bold">{SHEET_COMPANY_INFO.companyName}</p>
        <p className="mt-1 text-[10px] text-[#64748B]">
          {SHEET_COMPANY_INFO.addressLine1}
        </p>
        <p className="text-[10px] text-[#64748B]">{SHEET_COMPANY_INFO.cityStateZip}</p>
        <p className="text-[10px] text-[#007F96]">{SHEET_COMPANY_INFO.email}</p>
      </div>
    </>
  );
}
