const fs = require("fs");
const path = require("path");
const twoFactorCode = require("./twoFactorCode");
const invoiceEmail = require("./invoiceEmail");

function loadTemplate(templateName) {
  const filePath = path.join(__dirname, `${templateName}.txt`);
  return fs.readFileSync(filePath, "utf8");
}

function renderTemplate(templateName, variables = {}) {
  let content = loadTemplate(templateName);

  Object.entries(variables).forEach(([key, value]) => {
    content = content.replaceAll(`{{${key}}}`, String(value));
  });

  return content;
}

function renderTwoFactorEmail(variables) {
  return {
    text: twoFactorCode.renderTwoFactorText(variables),
    html: twoFactorCode.renderTwoFactorHtml(variables),
  };
}

function renderInvoiceEmail(variables) {
  return {
    text: invoiceEmail.renderInvoiceText(variables),
    html: invoiceEmail.renderInvoiceHtml(variables),
  };
}

module.exports = {
  loadTemplate,
  renderTemplate,
  renderTwoFactorEmail,
  renderInvoiceEmail,
};
