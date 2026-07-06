require("dotenv").config();

console.log(
  "This script is deprecated. Use:\n" +
    "  node scripts/migrate-employee-milestone-events.js\n" +
    "  node scripts/backfill-employee-milestone-events.js"
);

process.exit(0);
