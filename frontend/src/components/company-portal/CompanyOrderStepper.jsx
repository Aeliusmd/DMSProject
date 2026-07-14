"use client";

import { COMPANY_ORDER_STEPS } from "@/lib/company-portal/companyPortalOrderUtils";

export default function CompanyOrderStepper({ currentStep = 1 }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0 px-2">
      {COMPANY_ORDER_STEPS.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;
        const isLast = index === COMPANY_ORDER_STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex min-w-[72px] flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${
                  isComplete
                    ? "bg-[#22C55E] text-white"
                    : isActive
                      ? "bg-[#0097B2] text-white"
                      : "bg-[#E2E8F0] text-[#94A3B8]"
                }`}
              >
                {isComplete ? "✓" : step.id}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isActive || isComplete ? "text-[#0F172A]" : "text-[#94A3B8]"
                }`}
              >
                {step.label}
              </span>
            </div>

            {!isLast ? (
              <div
                className={`mb-5 h-[2px] w-10 sm:w-16 ${
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
