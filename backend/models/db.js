const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'homematch',
    waitForConnections: true,
    connectionLimit:    10,
});

/**
 * Wrapper so all routes can use:  await db.query(sql, [params])
 * mysql2 returns [rows, fields] — we return { rows } to match pg style.
 * Also converts PostgreSQL-style $1,$2 placeholders → MySQL ? placeholders.
 */
async function query(sql, params = []) {
    // Convert $1, $2, ... → ?
    const mysqlSQL = sql.replace(/\$\d+/g, '?');
    const [rows] = await pool.execute(mysqlSQL, params);
    return { rows: Array.isArray(rows) ? rows : [rows] };
}

module.exports = { query };
