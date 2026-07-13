const STEPS = [
  { id: 1, label: "Request Info" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Complete" },
];

export default function RequestStepper({ currentStep = 1 }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0 px-2">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.id;
        const isComplete = currentStep > step.id;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold ${
                  isComplete
                    ? "bg-[#22C55E] text-white"
                    : isActive
                      ? "bg-[#0097B2] text-white"
                      : "bg-[#E2E8F0] text-white"
                }`}
              >
                {isComplete ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M3 7.2L5.8 10L11 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`mt-2 text-[11px] font-medium ${
                  isActive || isComplete ? "text-[#0097B2]" : "text-[#94A3B8]"
                }`}
              >
                {step.label}
              </span>
            </div>

            {!isLast ? (
              <div
                className={`mx-3 mb-5 h-[2px] w-14 sm:mx-4 sm:w-20 ${
                  currentStep > step.id ? "bg-[#22C55E]" : "bg-[#E2E8F0]"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
