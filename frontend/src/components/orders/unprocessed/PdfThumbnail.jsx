export default function PdfThumbnail({ fileName }) {
  return (
    <div className="relative h-[78px] w-[58px] overflow-hidden rounded-[3px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="h-[10px] bg-[#F8FAFC]" />

      <div className="px-[7px] py-[6px]">
        <div className="mb-[5px] h-[5px] w-[36px] rounded bg-[#CBD5E1]" />
        <div className="mb-[4px] h-[3px] w-[28px] rounded bg-[#E2E8F0]" />
        <div className="mb-[4px] h-[3px] w-[38px] rounded bg-[#E2E8F0]" />
        <div className="mb-[4px] h-[3px] w-[32px] rounded bg-[#E2E8F0]" />

        <div className="mt-[7px] grid grid-cols-2 gap-[3px]">
          <div className="h-[14px] rounded bg-[#F1F5F9]" />
          <div className="h-[14px] rounded bg-[#F1F5F9]" />
        </div>

        <div className="mt-[6px] h-[3px] w-[36px] rounded bg-[#E2E8F0]" />
        <div className="mt-[3px] h-[3px] w-[25px] rounded bg-[#E2E8F0]" />
      </div>

      <div className="absolute bottom-1 left-1 rounded bg-red-50 px-[4px] py-[1px] text-[8px] font-semibold text-red-500">
        PDF
      </div>
    </div>
  );
}