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

async function getProviderById(id) {
  const provider = await Provider.findById(id);

  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  return mapProviderRow(provider);
}

module.exports = {
  getAllProviders,
  getProviderById,
};
