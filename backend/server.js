require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config");

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`DMS API running in ${config.nodeEnv} mode on port ${PORT}`);
});
