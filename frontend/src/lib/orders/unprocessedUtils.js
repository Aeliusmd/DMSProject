export function buildUnprocessedDisplayTitle(item = {}) {
  const applicant = String(item.applicantName || "").trim();
  const caseName = String(item.caseName || "").trim();
  const referenceCode = String(item.referenceCode || "").trim();

  if (applicant && caseName) {
    return `${applicant} — ${caseName}`;
  }

  if (applicant) return applicant;
  if (caseName) return caseName;
  if (referenceCode) return referenceCode;

  return item.fileName || "Unprocessed Subpoena";
}

export function mapUnprocessedSubpoenaItem(item = {}) {
  const pages = Number(item.pages ?? item.pageCount) || 0;

  return {
    id: item.id,
    parentId: item.parentId,
    referenceCode: item.referenceCode || "",
    subpoenaIndex: item.subpoenaIndex ?? null,
    batchReferenceCode: item.batchReferenceCode || "",
    batchFileName: item.batchFileName || "",
    fileName: item.fileName || "",
    displayTitle: buildUnprocessedDisplayTitle(item),
    uploadedAt: item.uploadedAt || "",
    pages,
    size: item.size || "",
    applicantName: item.applicantName || "",
    caseName: item.caseName || "",
    orderNumber: item.orderNumber || "",
  };
}
