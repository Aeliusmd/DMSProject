/**
 * Provider business logic — called by providerController.
 */

const ApiError = require("../utils/ApiError");
const { stripControlCharacters, sanitizeSearchText } = require("../utils/sanitize");
const Provider = require("../models/Provider");
const { sanitizeZip } = require("../utils/zipUtils");
const { parseUsAddress } = require("../utils/addressParseUtils");

function mapProviderRow(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    address: row.address || "",
    zip: sanitizeZip(row.zip_code || ""),
    zipCode: sanitizeZip(row.zip_code || ""),
    city: row.city || "",
    state: row.state || "",
    phone: row.phone || "",
    fax: row.fax || "",
    email: row.email || "",
  };
}

async function getAllProviders() {
  const providers = await Provider.findAll();
  return providers.map(mapProviderRow);
}

async function searchProviders(query) {
  const providers = await Provider.search(sanitizeSearchText(query));
  return providers.map(mapProviderRow);
}

async function getProviderById(id) {
  const provider = await Provider.findById(id);

  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  return mapProviderRow(provider);
}

function cleanText(value, maxLength = 4000) {
  return stripControlCharacters(value).trim().slice(0, maxLength);
}

function buildProviderPayload(data = {}) {
  const companyName = cleanText(
    data.companyName ?? data.serveCompanyName ?? "",
    255
  );

  if (!companyName) {
    throw new ApiError(400, "Provider company name is required");
  }

  return {
    companyName,
    address: cleanText(data.address ?? "", 255),
    zipCode: sanitizeZip(data.zipCode ?? data.zip ?? ""),
    city: cleanText(data.city ?? "", 100),
    state: cleanText(data.state ?? "", 2),
    phone: cleanText(data.phone ?? "", 20),
    fax: cleanText(data.fax ?? "", 20),
    email: cleanText(data.email ?? "", 255),
  };
}

async function updateProvider(id, data) {
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    throw new ApiError(400, "Invalid provider id");
  }

  const existing = await Provider.findById(providerId);

  if (!existing) {
    throw new ApiError(404, "Provider not found");
  }

  const payload = buildProviderPayload(data);
  await Provider.update(null, providerId, payload);

  return getProviderById(providerId);
}

function buildProviderDataFromHints(orderHints = {}) {
  const companyName = `${orderHints.companyName || ""}`.trim();
  if (!companyName) {
    return null;
  }

  const parsed = parseUsAddress(orderHints.companyAddress);

  return {
    companyName,
    serveCompanyName: companyName,
    address: parsed.address || `${orderHints.companyAddress || ""}`.trim(),
    zip: sanitizeZip(parsed.zip || ""),
    zipCode: sanitizeZip(parsed.zip || ""),
    city: parsed.city || "",
    state: parsed.state || "",
    phone: "",
    fax: "",
    email: "",
  };
}

/**
 * Match provider by company name (case-insensitive) or create a new row.
 * Returns { provider, created }.
 */
async function findOrCreateProvider(data, connection = null) {
  const payload = buildProviderPayload(data);
  const companyName = payload.companyName;

  const existing = await Provider.findByCompanyName(companyName, connection);
  if (existing) {
    // Extraction payloads often include blank contact fields. Keep any
    // already-known provider details instead of wiping them on match.
    const mergedPayload = {
      companyName: payload.companyName || existing.company_name || "",
      address: payload.address || existing.address || "",
      zipCode: payload.zipCode || existing.zip_code || "",
      city: payload.city || existing.city || "",
      state: payload.state || existing.state || "",
      phone: payload.phone || existing.phone || "",
      fax: payload.fax || existing.fax || "",
      email: payload.email || existing.email || "",
    };
    await Provider.update(connection, existing.id, mergedPayload);
    const updated = await Provider.findById(existing.id, connection);
    return { provider: mapProviderRow(updated), created: false };
  }

  const providerId = await Provider.create(connection, payload);
  const created = await Provider.findById(providerId, connection);
  return { provider: mapProviderRow(created), created: true };
}

/**
 * Resolve extracted subpoena provider hints against the DB.
 * Adds providerId to orderHints when matched or newly created.
 */
async function resolveProviderFromHints(orderHints = {}, connection = null) {
  const providerData = buildProviderDataFromHints(orderHints);
  if (!providerData) {
    return { orderHints, provider: null, created: false };
  }

  const { provider, created } = await findOrCreateProvider(providerData, connection);

  const enrichedHints = {
    ...orderHints,
    providerId: String(provider.id),
    providerEmail: provider.email || "",
    companyName: provider.companyName,
    companyAddress:
      orderHints.companyAddress ||
      [provider.address, provider.city, provider.state, provider.zip]
        .filter(Boolean)
        .join(", "),
  };

  return { orderHints: enrichedHints, provider, created };
}

module.exports = {
  getAllProviders,
  searchProviders,
  getProviderById,
  updateProvider,
  buildProviderPayload,
  findOrCreateProvider,
  resolveProviderFromHints,
};
