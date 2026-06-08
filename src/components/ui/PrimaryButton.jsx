export default function PrimaryButton({
  children,
  type = "button",
  disabled,
  onClick,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`h-[36px] w-full rounded-[6px] text-[13px] font-medium text-white transition-all ${
        disabled
          ? "cursor-not-allowed bg-[#0097B2]/45"
          : "bg-[#0097B2] hover:bg-[#0086A0] active:bg-[#00748A]"
      }`}
    >
      {children}
    </button>
  );
}