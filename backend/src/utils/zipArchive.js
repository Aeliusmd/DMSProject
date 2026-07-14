/**
 * archiver v8 is ESM-only and exports ZipArchive instead of a callable factory.
 */
function createZipArchive(options = {}) {
  const { ZipArchive } = require("archiver");

  if (typeof ZipArchive !== "function") {
    throw new Error("ZipArchive is unavailable from the archiver package");
  }

  return new ZipArchive({
    zlib: { level: 9 },
    ...options,
  });
}

module.exports = {
  createZipArchive,
};
