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

function formatCnrEmailNoteDate(value) {
  if (!value) return "";
  const parsed = new Date(
    typeof value === "string" && !value.includes("T") ? `${value}T12:00:00` : value
  );
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function CertificateNoRecordsPanel({
  formData,
  onChange,
  onBlur,
  getError,
}) {
  const showEmailNote =
    formData.cnrMemo &&
    formData.cnrDelivery === "email" &&
    formData.cnrDateSent &&
    String(formData.email || "").trim();

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

          {getError("cnrDelivery") && (
            <p className="mt-2 text-[11px] font-medium text-red-500">
              {getError("cnrDelivery")}
            </p>
          )}

          <div className="mt-5">
            <NewOrderField
              label={
                formData.cnrDelivery
                  ? formData.cnrDelivery === "pickup"
                    ? "Pickup date *"
                    : "Date Sent *"
                  : "Date Sent"
              }
              name="cnrDateSent"
              value={formData.cnrDateSent}
              onChange={onChange}
              onBlur={onBlur}
              type="date"
              error={getError("cnrDateSent")}
            />

            {showEmailNote ? (
              <p className="mt-2 text-[11px] italic leading-[16px] text-[#64748B]">
                Email will be sent on {formatCnrEmailNoteDate(formData.cnrDateSent)} for
                information.
              </p>
            ) : null}
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