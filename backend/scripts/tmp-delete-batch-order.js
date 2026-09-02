require("dotenv").config();
const { connectDatabase } = require("../src/config/database");
const orderService = require("../src/services/orderService");

async function main() {
  await connectDatabase();

  const orderId = 75;
  const actorId = 9;
  const actorName = "Chamodya";

  const result = await orderService.deleteOrder(orderId, { actorId, actorName });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
