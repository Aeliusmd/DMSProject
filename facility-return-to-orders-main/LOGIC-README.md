# Facility create -> return to Orders (main branch)

Source: origin/main from DMSProject

NOTE: Path facilities/FacilityId/info/page.jsx is from facilities/[FacilityId]/info/page.jsx
(brackets removed so Windows zip tools do not treat it as a wildcard).

## Related files

1. frontend/src/app/(dashboard)/orders/new/page.jsx
2. frontend/src/app/(dashboard)/facilities/FacilityId/info/page.jsx
3. frontend/src/components/orders/new-order/FacilitySearchField.jsx
4. frontend/src/components/orders/new-order/DoctorSearchField.jsx
5. frontend/src/lib/orders/facilityOrderUtils.js
6. frontend/src/lib/facilities/facilityApi.js
7. frontend/src/lib/orders/orderApi.js
8. frontend/src/app/(dashboard)/facilities/new/page.jsx

## Logic on main

The newly created facility is NOT selected by "newest in list".
It is kept via sessionStorage draft + URL flag facilityRefresh=1.

1) On /orders/new
   - User selects/creates facility -> form.facility = facilityId
   - Draft saved to sessionStorage key dms:order-draft-session:{scope}
     with facilityId, facilityName, formSnapshot

2) Open facility profile to complete
   - FacilitySearchField link:
     /facilities/{id}/info?returnTo=/orders/new?...
   - Draft flushed before leaving

3) Save on facility info page
   - If returnTo is /orders/new..., show Return to order modal
   - On confirm: router.push(returnTo + facilityRefresh=1)
   - main relies on draft facilityId (no applyFacilityId on main)

4) Back on /orders/new
   - Sees facilityRefresh=1
   - Restores session draft
   - resolvePendingFacility(draft.facilityId)
   - Sets form.facility and form.facilityName
   - Clears facilityRefresh from URL

Standalone /facilities/new does not hand back into the order form on main.