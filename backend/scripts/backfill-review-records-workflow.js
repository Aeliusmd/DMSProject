require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const [result] = await connection.execute(
    `UPDATE order_workflow_stages review_stage
     INNER JOIN order_workflow_stages upload_stage
       ON upload_stage.order_id = review_stage.order_id
     SET review_stage.stage_status = 'complete',
         review_stage.completed_at = COALESCE(
           review_stage.completed_at,
           upload_stage.completed_at,
           NOW()
         ),
         review_stage.updated_at = NOW()
     WHERE upload_stage.stage_name = 'Upload Records'
       AND upload_stage.stage_status = 'complete'
       AND review_stage.stage_name = 'Review Records'
       AND review_stage.stage_status <> 'complete'`
  );

  console.log(`Backfilled Review Records for ${result.affectedRows} order(s)`);
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
