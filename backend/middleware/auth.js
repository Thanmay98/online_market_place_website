// backend/middleware/auth.js
// Lightweight auth for this coursework (no sessions/JWT).
// The client sends the logged-in user's id in the "x-user-id" header;
// authenticate() loads that user from the DB and rejects unknown or
// blocked accounts. authorize(...roles) then gates routes by role.

const pool = require("../db");

async function authenticate(req, res, next) {
  const userId = Number(req.header("x-user-id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT user_id, name, email, role, status FROM users WHERE user_id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }
    if (rows[0].status === "blocked") {
      return res.status(403).json({ success: false, message: "Account is blocked" });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("authenticate failed:", err.message);
    res.status(500).json({ success: false, message: "Authentication error" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
