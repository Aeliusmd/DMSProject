"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { searchOrderDoctors } from "@/lib/orders/orderApi";

function namesMatch(left = "", right = "") {
  return (
    `${left || ""}`.trim().localeCompare(`${right || ""}`.trim(), undefined, {
      sensitivity: "accent",
    }) === 0
  );
}

function DoctorStatusNote({
  tone = "info",
  title,
  message,
  linkHref = "",
  linkLabel = "",
  onLinkClick,
}) {
  const styles = {
    info: {
      wrap: "border-[#BAE6FD] bg-[#F0F9FF]",
      title: "text-[#0369A1]",
      message: "text-[#0C4A6E]",
      link: "text-[#007F96]",
    },
    success: {
      wrap: "border-[#BBF7D0] bg-[#F0FDF4]",
      title: "text-[#047857]",
      message: "text-[#065F46]",
      link: "text-[#047857]",
    },
    warning: {
      wrap: "border-[#FDE68A] bg-[#FFFBEB]",
      title: "text-[#B45309]",
      message: "text-[#92400E]",
      link: "text-[#007F96]",
    },
  }[tone];

  return (
    <div className={`mt-2 rounded-[6px] border px-3 py-2 ${styles.wrap}`}>
      {title ? (
        <p className={`text-[11px] font-semibold ${styles.title}`}>{title}</p>
      ) : null}
      {message ? (
        <p className={`${title ? "mt-1" : ""} text-[10px] leading-snug ${styles.message}`}>
          {message}
        </p>
      ) : null}
      {linkHref ? (
        <Link
          href={linkHref}
          onClick={() => onLinkClick?.()}
          className={`${title || message ? "mt-2" : ""} inline-flex text-[11px] font-semibold underline ${styles.link}`}
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default function DoctorSearchField({
  label = "Specific Doctor",
  name = "specificDoctor",
  value = "",
  facilityId = "",
  facilityName = "",
  specificDoctorIsDefault = false,
  specificDoctorId = "",
  extractedDoctorName = "",
  onChange,
  onBlur,
  placeholder = "Doctor name",
  required = false,
  error = "",
  missingDefaultDoctor = false,
  doctorCreated = false,
  resolvingDoctor = false,
  returnToOrderPath = "",
  onBeforeFacilityProfileNavigate,
  isPersonalPortal = false,
  doctorNotInSystem = false,
  facilityNotInSystem = false,
  orderEndedNoFacility = false,
  onDoctorBlur,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchSettled, setSearchSettled] = useState(false);
  const [queryMatchesFacility, setQueryMatchesFacility] = useState(false);

  const requestedDoctor = `${extractedDoctorName || ""}`.trim();
  const doctorNameForAdd = requestedDoctor || `${value || ""}`.trim();
  const facilityDoctorsHref = facilityId
    ? (() => {
        const params = new URLSearchParams();
        if (returnToOrderPath) params.set("returnTo", returnToOrderPath);
        params.set("focus", "doctors");
        if (doctorNameForAdd) params.set("doctorName", doctorNameForAdd);
        return `/facilities/${facilityId}/info?${params.toString()}`;
      })()
    : "";

  const statusNote = useMemo(() => {
    if (resolvingDoctor) {
      return {
        tone: "info",
        title: "Updating doctor for this facility",
        message: isPersonalPortal
          ? "Matching the requested treating doctor, or applying the facility default when none was requested."
          : "Checking the selected facility and applying its default doctor when available.",
      };
    }

    if (!facilityId || orderEndedNoFacility) {
      return null;
    }

    const trimmedValue = `${value || ""}`.trim();
    const trimmedExtracted = requestedDoctor;
    const facilityLabel = `${facilityName || "this facility"}`.trim();

    const typedNameMissingOnFacility =
      isPersonalPortal &&
      !facilityNotInSystem &&
      trimmedValue.length >= 1 &&
      !specificDoctorIsDefault &&
      !resolvingDoctor &&
      searchSettled &&
      !queryMatchesFacility;

    const doctorMissing =
      doctorNotInSystem || typedNameMissingOnFacility;

    if (isPersonalPortal && facilityNotInSystem) {
      return {
        tone: "warning",
        title: "Add facility before doctor",
        message: trimmedExtracted
          ? `Requested treating doctor: ${trimmedExtracted}. Add the facility to the system first, then add this doctor on the facility profile.`
          : "Add the facility to the system first. If a treating doctor was requested, you can add them after the facility is linked.",
      };
    }

    if (isPersonalPortal && doctorMissing && (trimmedExtracted || trimmedValue)) {
      const missingName =
        typedNameMissingOnFacility && trimmedValue
          ? trimmedValue
          : trimmedExtracted || trimmedValue;
      return {
        tone: "warning",
        title: "Specific doctor not in facility",
        message: `${missingName} is not on ${facilityLabel} yet (this facility has no matching doctor).`,
        linkHref: facilityDoctorsHref,
        linkLabel: "Add this doctor to facility",
      };
    }

    if (missingDefaultDoctor) {
      return {
        tone: "warning",
        title: "No default doctor for this facility",
        message: isPersonalPortal
          ? trimmedExtracted
            ? `Requested treating doctor is not on ${facilityLabel}. Add that doctor, or add/select a default doctor, then return here.`
            : `No treating doctor was requested. Add a default doctor on the facility profile, then return here to continue.`
          : `This facility has no default doctor. Add a doctor on the facility profile, then return here to continue the order.`,
        linkHref: facilityDoctorsHref,
        linkLabel: "Open facility profile to add doctors",
      };
    }

    if (!trimmedValue) {
      if (isPersonalPortal && !trimmedExtracted && !missingDefaultDoctor) {
        return null;
      }
      return {
        tone: "warning",
        title: "No doctor selected",
        message: `Choose a doctor for ${facilityLabel}, or add one on the facility profile.`,
        linkHref: facilityDoctorsHref,
        linkLabel: "Open facility profile to add doctors",
      };
    }

    if (doctorCreated && trimmedExtracted && !isPersonalPortal) {
      return {
        tone: "success",
        title: "Doctor added from subpoena",
        message: `${trimmedValue} was created for ${facilityLabel} based on the uploaded subpoena.`,
        linkHref: facilityDoctorsHref,
        linkLabel: "Add another doctor",
      };
    }

    if (specificDoctorIsDefault) {
      return {
        tone: "info",
        title: "Using facility default doctor",
        message: isPersonalPortal
          ? `${trimmedValue} is the default doctor for ${facilityLabel}. No treating doctor was requested.`
          : `${trimmedValue} is the default doctor for ${facilityLabel}. No doctor was identified on the subpoena.`,
        linkHref: facilityDoctorsHref,
        linkLabel: "Add another doctor",
      };
    }

    if (trimmedExtracted) {
      if (namesMatch(trimmedValue, trimmedExtracted) && !doctorMissing) {
        return {
          tone: "info",
          title: isPersonalPortal
            ? "Matched requested treating doctor"
            : "Matched from subpoena",
          message: isPersonalPortal
            ? `${trimmedValue} matches the treating doctor from the personal request.`
            : `${trimmedValue} was identified on the uploaded subpoena.`,
          linkHref: facilityDoctorsHref,
          linkLabel: "Add another doctor",
        };
      }

      if (!doctorMissing) {
        return {
          tone: "info",
          title: "Doctor updated from facility profile",
          message: isPersonalPortal
            ? `The request listed ${trimmedExtracted}. The facility profile now shows ${trimmedValue}.`
            : `The subpoena listed ${trimmedExtracted}. The facility profile now shows ${trimmedValue}.`,
          linkHref: facilityDoctorsHref,
          linkLabel: "Add another doctor",
        };
      }
    }

    if (doctorMissing) {
      return null;
    }

    if (
      isPersonalPortal &&
      trimmedValue &&
      !specificDoctorIsDefault &&
      !`${specificDoctorId || ""}`.trim() &&
      !searchSettled
    ) {
      return null;
    }

    if (
      isPersonalPortal &&
      trimmedValue &&
      !specificDoctorIsDefault &&
      !`${specificDoctorId || ""}`.trim() &&
      searchSettled &&
      !queryMatchesFacility
    ) {
      return null;
    }

    return {
      tone: "info",
      title: "Doctor selected",
      message: `${trimmedValue} is linked to ${facilityLabel}.`,
      linkHref: facilityDoctorsHref,
      linkLabel: "Add another doctor",
    };
  }, [
    resolvingDoctor,
    facilityId,
    facilityName,
    value,
    requestedDoctor,
    missingDefaultDoctor,
    doctorCreated,
    specificDoctorIsDefault,
    specificDoctorId,
    facilityDoctorsHref,
    isPersonalPortal,
    doctorNotInSystem,
    facilityNotInSystem,
    orderEndedNoFacility,
    searchSettled,
    queryMatchesFacility,
  ]);

  useEffect(() => {
    const query = value.trim();
    const shouldSearch =
      Boolean(facilityId) &&
      query.length >= 1 &&
      (open || (isPersonalPortal && !facilityNotInSystem && !specificDoctorIsDefault));

    if (!shouldSearch) {
      if (!isPersonalPortal || !query.length) {
        setSuggestions([]);
        setLoading(false);
        setSearchError("");
        setSearchSettled(false);
        setQueryMatchesFacility(false);
      }
      return undefined;
    }

    let active = true;
    setLoading(true);
    setSearchError("");
    setSearchSettled(false);

    const timer = setTimeout(() => {
      searchOrderDoctors(query, { facility: facilityId })
        .then((doctors) => {
          if (!active) return;
          if (open) {
            setSuggestions(doctors);
          }
          setQueryMatchesFacility(
            doctors.some((doctor) => namesMatch(doctor, query))
          );
          setSearchSettled(true);
        })
        .catch((err) => {
          if (!active) return;
          if (open) {
            setSuggestions([]);
          }
          setSearchError(getApiErrorMessage(err, "Failed to search doctors"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    value,
    open,
    facilityId,
    isPersonalPortal,
    facilityNotInSystem,
    specificDoctorIsDefault,
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasError = Boolean(error);
  const showSuggestions = open && value.trim().length >= 1;

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    });
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={(event) => {
          emitChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          onBlur?.(event);
          onDoctorBlur?.(event);
        }}
        placeholder={placeholder}
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        autoComplete="off"
      />

      {statusNote ? (
        <DoctorStatusNote
          tone={statusNote.tone}
          title={statusNote.title}
          message={statusNote.message}
          linkHref={statusNote.linkHref}
          linkLabel={statusNote.linkLabel}
          onLinkClick={onBeforeFacilityProfileNavigate}
        />
      ) : null}

      {error ? (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">{error}</p>
      ) : null}

      {showSuggestions && (
        <ul
          id={listboxId}
          className="absolute z-20 mt-1 max-h-[220px] w-full overflow-auto rounded-[6px] border border-[#E2E8F0] bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">Searching...</li>
          )}

          {!loading && searchError && (
            <li className="px-3 py-2 text-[12px] text-red-500">{searchError}</li>
          )}

          {!loading &&
            !searchError &&
            suggestions.map((doctor) => (
              <li key={doctor}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    emitChange(doctor);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-[12px] font-medium text-[#111827] hover:bg-[#F0FBFD]"
                >
                  {doctor}
                </button>
              </li>
            ))}

          {!loading && !searchError && suggestions.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
              {isPersonalPortal && facilityDoctorsHref ? (
                <>
                  No matching doctors —{" "}
                  <Link
                    href={facilityDoctorsHref}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onBeforeFacilityProfileNavigate?.()}
                    className="font-semibold text-[#007F96] underline"
                  >
                    Add this doctor to facility
                  </Link>
                </>
              ) : isPersonalPortal ? (
                "No matching doctors — use Add this doctor to facility above"
              ) : (
                "No matching doctors — continue typing to add a new one"
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
