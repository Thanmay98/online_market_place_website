// backend/log.js
// Records an entry in the system_logs table. Best-effort by design:
// logging must never break the actual request, so any error here is
// swallowed (just warned to the console).

const pool = require("./db");

async function logActivity(userId, action, description, req) {
  try {
    let ip = null;
    if (req) {
      ip = req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || null;
      if (ip) ip = String(ip).slice(0, 45); // column is VARCHAR(45)
    }
    await pool.query(
      "INSERT INTO system_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)",
      [userId || null, action, description || null, ip]
    );
  } catch (err) {
    console.error("logActivity failed:", err.message);
  }
}

module.exports = { logActivity };
