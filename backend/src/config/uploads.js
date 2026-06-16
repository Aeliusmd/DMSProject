const path = require("path");
const fs = require("fs");

const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const facilityUploadsDir = path.join(uploadsRoot, "facilities");

function ensureUploadDirs() {
  [uploadsRoot, facilityUploadsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

module.exports = {
  uploadsRoot,
  facilityUploadsDir,
  ensureUploadDirs,
};
