export default function AuthInput({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  leftIcon,
  rightIcon,
  error,
}) {
  return (
    <div>
      <label className="mb-[8px] block text-[12px] font-medium text-[#334155]">
        {label}
      </label>

      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-[#94A3B8]">
            {leftIcon}
          </div>
        )}

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`h-[38px] w-full rounded-[6px] border bg-[#F8FAFC] pl-[42px] pr-[42px] text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:bg-white focus:ring-2 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
        />

        {rightIcon && (
          <div className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[#94A3B8]">
            {rightIcon}
          </div>
        )}
      </div>

      {error && <p className="mt-[6px] text-[12px] text-red-500">{error}</p>}
    </div>
  );
}