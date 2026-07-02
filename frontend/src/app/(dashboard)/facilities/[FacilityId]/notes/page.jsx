import { redirect } from "next/navigation";

export default function FacilityNotesRedirectPage({ params }) {
  const facilityId = String(
    params?.facilityId || params?.FacilityId || params?.id || ""
  );

  if (!facilityId) {
    redirect("/facilities");
  }

  redirect(`/facilities/${facilityId}/info`);
}
