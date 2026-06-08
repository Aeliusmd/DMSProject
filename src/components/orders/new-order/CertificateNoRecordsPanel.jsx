"use client";

import NewOrderField, {
  CheckboxOption,
  RadioOption,
} from "@/components/orders/new-order/NewOrderField";

const standardReasons = [
  "All records will be provided under your reference number.",
  "Patient never showed for appointment, therefore no records can be provided.",
  "Patient was not treated by the above named doctor.",
  "Patient was not treated at the above named facility.",
];

export default function CertificateNoRecordsPanel({
  formData,
  onChange,
  onBlur,
  getError,
}) {
  return (
    <div className="mt-4 rounded-[8px] border border-[#FACC15] bg-[#FFFBEB] px-4 py-4">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_170px]">
        <div className="min-w-0">
          <NewOrderField
            label="CNR Reason"
            name="cnrReason"
            value={formData.cnrReason}
            onChange={onChange}
            onBlur={onBlur}
            textarea
            placeholder="Enter CNR reason..."
            error={getError("cnrReason")}
          />

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold text-[#B45309]">
              Standard Reasons
            </p>

            <div className="space-y-2">
              {standardReasons.map((reason, index) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() =>
                    onChange({
                      target: {
                        name: "cnrReason",
                        value: reason,
                        type: "text",
                      },
                    })
                  }
                  className="block text-left text-[13px] leading-[19px] text-[#2563EB] hover:underline"
                >
                  {index + 1}. {reason}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-3 text-[11px] font-semibold text-[#B45309]">
            Delivery
          </p>

          <div className="space-y-3">
            <RadioOption
              label="Email"
              name="cnrDelivery"
              value="email"
              checked={formData.cnrDelivery === "email"}
              onChange={onChange}
            />

            <RadioOption
              label="Fax"
              name="cnrDelivery"
              value="fax"
              checked={formData.cnrDelivery === "fax"}
              onChange={onChange}
            />

            <RadioOption
              label="Pickup"
              name="cnrDelivery"
              value="pickup"
              checked={formData.cnrDelivery === "pickup"}
              onChange={onChange}
            />
          </div>

          <div className="mt-5">
            <NewOrderField
              label="Date Sent"
              name="cnrDateSent"
              value={formData.cnrDateSent}
              onChange={onChange}
              onBlur={onBlur}
              type="date"
              error={getError("cnrDateSent")}
            />
          </div>

          <div className="mt-3">
            <CheckboxOption
              label="Memo?"
              name="cnrMemo"
              checked={formData.cnrMemo}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}