// backend/db.js
// MySQL connection pool for the Online Marketplace backend.
// Every route imports this pool and runs queries against the
// `online_marketplace` database created by database/schema.sql.
//
// SET YOUR MYSQL PASSWORD below (or export DB_PASSWORD before
// starting the server). The other defaults match a standard
// local MySQL install.

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "YOUR_MYSQL_PASSWORD_HERE",
  database: process.env.DB_NAME     || "online_marketplace",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
