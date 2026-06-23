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

module.exports = {
  getAllProviders,
  searchProviders,
  getProviderById,
  updateProvider,
  buildProviderPayload,
};
