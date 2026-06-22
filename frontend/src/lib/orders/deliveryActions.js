/**
 * Completed-order delivery actions (Mail / Fax / Pickup).
 * When CNR is enabled, only the selected cnr_delivery option is shown.
 * Otherwise Mail + Pickup are shown (no Fax).
 * After mail or pickup is recorded, the other option is hidden.
 */
export function getCompletedDeliveryActions(order) {
  if (!order || order.orderStatus !== "Completed") {
    return { mail: false, fax: false, pickup: false };
  }

  const mailDone = Boolean(order.mailSentDate);
  const pickupDone = Boolean(order.pickupPersonName);
  const faxDone =
    order.cnrDelivery === "fax" && Boolean(order.cnrDateSent);

  if (mailDone) {
    return { mail: true, fax: false, pickup: false };
  }

  if (pickupDone) {
    return { mail: false, fax: false, pickup: true };
  }

  if (faxDone) {
    return { mail: false, fax: true, pickup: false };
  }

  if (order.certificateNoRecords && order.cnrDelivery) {
    return {
      mail: order.cnrDelivery === "email",
      fax: order.cnrDelivery === "fax",
      pickup: order.cnrDelivery === "pickup",
    };
  }

  return { mail: true, fax: false, pickup: true };
}

export function resolveProviderEmail(order) {
  const direct = order?.company?.emailAddress?.trim();
  if (direct) return direct;

  const display = `${order?.company?.email || ""}`;
  const match = display.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return match ? match[0] : "";
}

export function formatDeliveryDate(dateStr) {
  if (!dateStr) return "";

  const [year, month, day] = `${dateStr}`.split("-");
  if (!year || !month || !day) return dateStr;

  return `${Number(month)}/${Number(day)}/${year}`;
}

export function getDeliveryStatus(order, action) {
  switch (action) {
    case "mail":
      return {
        completed: Boolean(order.mailSentDate),
        date: order.mailSentDate || "",
        hoverText: order.mailSentDate
          ? formatDeliveryDate(order.mailSentDate)
          : "",
      };
    case "pickup":
      return {
        completed: Boolean(order.pickupPersonName),
        date: order.deliveryDate || "",
        hoverText: [
          order.deliveryDate ? formatDeliveryDate(order.deliveryDate) : "",
          order.pickupPersonName || "",
        ]
          .filter(Boolean)
          .join(" • "),
      };
    case "fax":
      return {
        completed:
          order.cnrDelivery === "fax" && Boolean(order.cnrDateSent),
        date: order.cnrDateSent || "",
        hoverText:
          order.cnrDelivery === "fax" && order.cnrDateSent
            ? formatDeliveryDate(order.cnrDateSent)
            : "",
      };
    default:
      return { completed: false, date: "", hoverText: "" };
  }
}
