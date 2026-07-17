"use client";

import { useEffect, useState } from "react";
import {
  COMPANY_PORTAL_FACILITY_SEARCH_FEE,
} from "@/lib/company-portal/companyPortalOrderUtils";

const EMPTY_FORM = {
  facilityName: "",
  facilityAddress: "",
  facilityCity: "",
  facilityState: "",
  facilityZip: "",
  treatingDoctor: "",
};

export default function CompanyPortalAddFacilityModal({
  open,
  onClose,
  onSubmit,
  initialValues = {},
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, ...initialValues });
    setErrors({});
  }, [open, initialValues]);

  if (!open) return null;

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    if (!`${form.facilityAddress || ""}`.trim()) {
      nextErrors.facilityAddress = "Street address is required";
    }
    if (!`${form.facilityCity || ""}`.trim()) {
      nextErrors.facilityCity = "City is required";
    }
    const state = `${form.facilityState || ""}`.trim().toUpperCase();
    if (!state) {
      nextErrors.facilityState = "State is required";
    } else if (!/^[A-Z]{2}$/.test(state)) {
      nextErrors.facilityState = "State must be 2 letters";
    }
    const zipDigits = `${form.facilityZip || ""}`.replace(/\D/g, "");
    if (!zipDigits) {
      nextErrors.facilityZip = "ZIP code is required";
    } else if (zipDigits.length !== 5 && zipDigits.length !== 9) {
      nextErrors.facilityZip = "ZIP must be 5 digits";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;

    onSubmit?.({
      facilityName: `${form.facilityName || ""}`.trim(),
      facilityAddress: `${form.facilityAddress || ""}`.trim(),
      facilityCity: `${form.facilityCity || ""}`.trim(),
      facilityState: `${form.facilityState || ""}`.trim().toUpperCase(),
      facilityZip: zipDigitsFrom(form.facilityZip),
      treatingDoctor: `${form.treatingDoctor || ""}`.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-[12px] bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">
            Request new facility search
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
            DMS will search for this facility. A ${COMPANY_PORTAL_FACILITY_SEARCH_FEE.toFixed(2)}{" "}
            facility search fee will be added to your invoice only if we locate
            and add the facility. It is not charged now.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Facility name"
            optional
            name="facilityName"
            value={form.facilityName}
            onChange={handleChange}
          />
          <Field
            label="Street address"
            required
            name="facilityAddress"
            value={form.facilityAddress}
            onChange={handleChange}
            error={errors.facilityAddress}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="City"
              required
              name="facilityCity"
              value={form.facilityCity}
              onChange={handleChange}
              error={errors.facilityCity}
            />
            <Field
              label="State"
              required
              name="facilityState"
              value={form.facilityState}
              onChange={handleChange}
              error={errors.facilityState}
              placeholder="CA"
            />
            <Field
              label="ZIP"
              required
              name="facilityZip"
              value={form.facilityZip}
              onChange={handleChange}
              error={errors.facilityZip}
              placeholder="90017"
            />
          </div>
          <Field
            label="Specific doctor"
            optional
            name="treatingDoctor"
            value={form.treatingDoctor}
            onChange={handleChange}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E2E8F0] px-4 text-[13px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Add facility
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  optional,
  name,
  value,
  onChange,
  error,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[#334155]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {optional ? (
          <span className="font-normal text-[#94A3B8]"> (optional)</span>
        ) : null}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        className={`h-10 w-full rounded-[8px] border bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] outline-none focus:bg-white focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />
      {error ? <p className="mt-1 text-[12px] text-red-500">{error}</p> : null}
    </div>
  );
}

function zipDigitsFrom(value) {
  const digits = `${value || ""}`.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}
