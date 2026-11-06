// backend/routes/auth.js
// Registration and login. Passwords are compared as plain text
// (coursework simplification agreed with the team).

const express = require("express");
const pool = require("../db");
const { logActivity } = require("../log");

const router = express.Router();

// Register a new customer or seller.
// Admins / super admins are created by a super admin, not here.
router.post("/register", async (req, res) => {
  const { name, email, password, mobile, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Name, email and password are required" });
  }

  // Only customer/seller can self-register; anything else falls back to customer.
  const userRole = role === "seller" ? "seller" : "customer";
  // Sellers wait for admin approval; customers are active immediately.
  const status = userRole === "seller" ? "pending" : "active";

  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, mobile, role, status) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, password, mobile || null, userRole, status]
    );

    await logActivity(result.insertId, "REGISTER", `New ${userRole} registered: ${email}`, req);
    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: { user_id: result.insertId, name, email, role: userRole, status }
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }
    console.error("POST /api/auth/register failed:", err.message);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// Login.
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT user_id, name, email, password, role, status FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = rows[0];
    if (user.status === "blocked") {
      return res.status(403).json({ success: false, message: "Account is blocked" });
    }

    delete user.password; // never send the password back
    await logActivity(user.user_id, "LOGIN", `${user.email} logged in`, req);
    res.status(200).json({ success: true, message: "Login successful", user });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err.message);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

module.exports = router;
