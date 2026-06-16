const fs = require("fs");
const path = require("path");

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

module.exports = { loadTemplate, renderTemplate };
