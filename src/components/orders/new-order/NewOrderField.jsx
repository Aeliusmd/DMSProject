export default function NewOrderField({
  label,
  name = "",
  value = "",
  onChange,
  onBlur,
  type = "text",
  placeholder,
  required = false,
  error = "",
  disabled = false,
  options = [],
  textarea = false,
  hint,
  inputMode,
  maxLength,
}) {
  const hasError = Boolean(error);

  return (
    <div className="min-w-0">
      {label && (
        <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}

      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={`w-full resize-none rounded-[6px] border bg-white px-3 py-2 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
            hasError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          } ${
            disabled ? "cursor-not-allowed bg-[#F8FAFC] text-[#94A3B8]" : ""
          }`}
        />
      ) : options.length > 0 ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[13px] text-[#111827] outline-none focus:ring-2 ${
            hasError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          } ${
            disabled ? "cursor-not-allowed bg-[#F8FAFC] text-[#94A3B8]" : ""
          }`}
        >
          {options.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
            hasError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          } ${
            disabled ? "cursor-not-allowed bg-[#F8FAFC] text-[#94A3B8]" : ""
          }`}
        />
      )}

      {hint && !hasError && (
        <p className="mt-[4px] text-[10px] text-[#94A3B8]">{hint}</p>
      )}

      {hasError && (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxOption({ label, name, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-[#475569]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
      />
      {label}
    </label>
  );
}

export function RadioOption({ label, name, value, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-[#475569]">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-[13px] w-[13px] border-[#CBD5E1] accent-[#0097B2]"
      />
      {label}
    </label>
  );
}