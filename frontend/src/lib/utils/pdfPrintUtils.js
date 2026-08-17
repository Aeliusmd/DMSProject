const PRINT_FRAME_ID = "dms-pdf-print-frame";

/** Chrome needs a tick after load before its embedded PDF viewer accepts print(). */
const PRINT_DELAY_MS = 250;
const LOAD_TIMEOUT_MS = 8000;

const POPUP_BLOCKED_MESSAGE =
  "Your browser blocked the print window. Allow pop-ups for this site, or download the PDF and print it.";

/**
 * Firefox and Safari cannot print a PDF rendered inside an offscreen iframe,
 * so those browsers get the new-tab flow instead.
 */
function supportsHiddenFramePrint() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isFirefox = ua.includes("firefox");
  const isSafari =
    ua.includes("safari") &&
    !ua.includes("chrome") &&
    !ua.includes("chromium") &&
    !ua.includes("edg");

  return !isFirefox && !isSafari;
}

function openPdfInNewTab(url) {
  const tab = window.open(url, "_blank", "noopener");

  if (!tab) return false;

  tab.focus?.();
  return true;
}

/** Removes the offscreen print frame, if one is still around from a previous print. */
export function cleanupPdfPrintFrame() {
  if (typeof document === "undefined") return;

  document.getElementById(PRINT_FRAME_ID)?.remove();
}

/**
 * Opens the browser print dialog for a PDF url (blob or remote).
 * Falls back to opening the PDF in a new tab when the dialog cannot be triggered.
 */
export function printPdfFromUrl(url) {
  if (typeof window === "undefined" || !url) {
    return Promise.reject(new Error("There is no PDF to print yet."));
  }

  if (!supportsHiddenFramePrint()) {
    return openPdfInNewTab(url)
      ? Promise.resolve()
      : Promise.reject(new Error(POPUP_BLOCKED_MESSAGE));
  }

  cleanupPdfPrintFrame();

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.id = PRINT_FRAME_ID;
    frame.title = "PDF print frame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none;";

    let settled = false;

    const fallback = () => {
      if (settled) return;
      settled = true;
      cleanupPdfPrintFrame();

      if (openPdfInNewTab(url)) {
        resolve();
      } else {
        reject(new Error(POPUP_BLOCKED_MESSAGE));
      }
    };

    frame.onload = () => {
      window.setTimeout(() => {
        if (settled) return;

        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          settled = true;
          resolve();
        } catch {
          fallback();
        }
      }, PRINT_DELAY_MS);
    };

    frame.onerror = fallback;
    frame.src = url;
    document.body.appendChild(frame);

    window.setTimeout(fallback, LOAD_TIMEOUT_MS);
  });
}

/** Saves a PDF url (blob or remote) to disk under the given file name. */
export function downloadPdfFromUrl(url, fileName = "document.pdf") {
  if (typeof document === "undefined" || !url) return;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
