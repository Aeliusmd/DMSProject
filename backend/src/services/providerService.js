/**
 * Provider business logic — called by providerController.
 */

const ApiError = require("../utils/ApiError");
const Provider = require("../models/Provider");

function mapProviderRow(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    address: row.address || "",
    zip: row.zip_code || "",
    zipCode: row.zip_code || "",
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
  const providers = await Provider.search(query);
  return providers.map(mapProviderRow);
}

async function getProviderById(id) {
  const provider = await Provider.findById(id);

  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  return mapProviderRow(provider);
}

function buildProviderPayload(data = {}) {
  const companyName = `${data.companyName ?? data.serveCompanyName ?? ""}`.trim();

  if (!companyName) {
    throw new ApiError(400, "Provider company name is required");
  }

  return {
    companyName,
    address: `${data.address ?? ""}`.trim(),
    zipCode: `${data.zipCode ?? data.zip ?? ""}`.trim(),
    city: `${data.city ?? ""}`.trim(),
    state: `${data.state ?? ""}`.trim(),
    phone: `${data.phone ?? ""}`.trim(),
    fax: `${data.fax ?? ""}`.trim(),
    email: `${data.email ?? ""}`.trim(),
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

function parseUsAddress(fullAddress) {
  const trimmed = `${fullAddress || ""}`.trim();
  if (!trimmed) {
    return { address: "", city: "", state: "", zip: "" };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1) {
    const inlineMatch = trimmed.match(
      /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
    );

    if (inlineMatch) {
      return {
        address: inlineMatch[1].trim(),
        city: "",
        state: inlineMatch[2].toUpperCase(),
        zip: inlineMatch[3],
      };
    }

    return { address: trimmed, city: "", state: "", zip: "" };
  }

  const last = parts[parts.length - 1];
  const stateZipMatch = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (stateZipMatch) {
    return {
      address: parts.slice(0, -2).join(", "),
      city: parts.length >= 2 ? parts[parts.length - 2] : "",
      state: stateZipMatch[1].toUpperCase(),
      zip: stateZipMatch[2],
    };
  }

  const cityStateZipMatch = last.match(
    /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );

  if (cityStateZipMatch) {
    return {
      address: parts.slice(0, -1).join(", "),
      city: cityStateZipMatch[1].trim(),
      state: cityStateZipMatch[2].toUpperCase(),
      zip: cityStateZipMatch[3],
    };
  }

  return {
    address: parts.slice(0, -1).join(", "),
    city: parts[parts.length - 1],
    state: "",
    zip: "",
  };
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
    zip: parsed.zip || "",
    zipCode: parsed.zip || "",
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
    await Provider.update(connection, existing.id, payload);
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
