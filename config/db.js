import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

var pool;
if (process.env.NODE_ENV == 'test') {
    pool = new Pool({
        connectionString: process.env.test.local.NEON_TEST_URI,
        ssl: "verify-full"
    });

} else {
    pool = new Pool({
        connectionString: process.env.NEON_CONNECTION_URI,
        ssl: "verify-full"
    });
}

export default pool;
// await client.connect();
// console.log("Connected!");
//
// const result = await client.query('SELECT * FROM test');
// console.log(result.rows);
// async function getPgVersion() {
//     const result = await sql`SELECT * FROM test`;
//     console.log(result[0]);
// }
//
// getPgVersion();
