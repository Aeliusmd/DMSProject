/**
 * Completed-order delivery actions (Email / Fax / Pickup).
 * Shown when order status is Ready to Pickup (pending) or Completed (done).
 * ready_date stores the email sent date or pickup date after completion.
 */
export function getCompletedDeliveryActions(order) {
  const isDeliveryPhase =
    order?.orderStatus === "Ready to Pickup" ||
    order?.orderStatus === "Completed";

  if (!isDeliveryPhase) {
    return { mail: false, fax: false, pickup: false };
  }

  const pickupDone = Boolean(order.pickupPersonName);
  const mailDone =
    order.orderStatus === "Completed" &&
    Boolean(order.readyDate) &&
    !pickupDone;
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

  if (order.orderStatus !== "Ready to Pickup") {
    return { mail: false, fax: false, pickup: false };
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
    case "mail": {
      const mailCompleted =
        order.orderStatus === "Completed" &&
        Boolean(order.readyDate) &&
        !order.pickupPersonName;

      return {
        completed: mailCompleted,
        date: order.readyDate || "",
        hoverText: order.readyDate ? formatDeliveryDate(order.readyDate) : "",
      };
    }
    case "pickup":
      return {
        completed: Boolean(order.pickupPersonName),
        date: order.readyDate || order.deliveryDate || "",
        hoverText: [
          order.readyDate || order.deliveryDate
            ? formatDeliveryDate(order.readyDate || order.deliveryDate)
            : "",
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
