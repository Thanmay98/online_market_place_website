// backend/routes/admin.js
// Admin + super-admin tools: manage customers and sellers (list,
// search, block/unblock, approve/reject sellers) and view reports.

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { logActivity } = require("../log");

const router = express.Router();
router.use(authenticate, authorize("admin", "superadmin"));

// List users of a role, with optional name/email search and status filter.
async function listUsers(role, { search, status }) {
  let sql = "SELECT user_id, name, email, mobile, status, created_at FROM users WHERE role = ?";
  const params = [role];
  if (search) {
    sql += " AND (name LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

router.get("/customers", async (req, res) => {
  try {
    const rows = await listUsers("customer", { search: req.query.search, status: req.query.status });
    res.status(200).json({ success: true, count: rows.length, customers: rows });
  } catch (err) {
    console.error("GET /api/admin/customers failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch customers" });
  }
});

router.get("/sellers", async (req, res) => {
  try {
    const rows = await listUsers("seller", { search: req.query.search, status: req.query.status });
    res.status(200).json({ success: true, count: rows.length, sellers: rows });
  } catch (err) {
    console.error("GET /api/admin/sellers failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch sellers" });
  }
});

// Shared status-change logic. Never lets an admin touch another
// admin/super-admin account (that's super-admin territory).
async function setUserStatus(req, res, newStatus, requireRole) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: "Valid user id is required" });
  }
  try {
    const [rows] = await pool.query("SELECT role FROM users WHERE user_id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const target = rows[0];
    if (target.role === "admin" || target.role === "superadmin") {
      return res.status(403).json({ success: false, message: "Admin accounts cannot be managed here" });
    }
    if (requireRole && target.role !== requireRole) {
      return res.status(400).json({ success: false, message: `User is not a ${requireRole}` });
    }
    await pool.query("UPDATE users SET status = ? WHERE user_id = ?", [newStatus, userId]);
    const logAction = newStatus === "blocked" ? "USER_BLOCKED" : "USER_ACTIVATED";
    await logActivity(req.user.user_id, logAction, `User #${userId} set to ${newStatus}`, req);
    res.status(200).json({ success: true, message: `User status set to ${newStatus}` });
  } catch (err) {
    console.error("setUserStatus failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to update user status" });
  }
}

router.put("/users/:id/block",    (req, res) => setUserStatus(req, res, "blocked"));
router.put("/users/:id/unblock",  (req, res) => setUserStatus(req, res, "active"));
router.put("/sellers/:id/approve", (req, res) => setUserStatus(req, res, "active", "seller"));
router.put("/sellers/:id/reject",  (req, res) => setUserStatus(req, res, "blocked", "seller"));

// Marketplace reports: headline counts, revenue, and orders by status.
router.get("/reports", async (req, res) => {
  try {
    const [[{ total_customers }]] = await pool.query("SELECT COUNT(*) AS total_customers FROM users WHERE role='customer'");
    const [[{ total_sellers }]]   = await pool.query("SELECT COUNT(*) AS total_sellers FROM users WHERE role='seller'");
    const [[{ total_products }]]  = await pool.query("SELECT COUNT(*) AS total_products FROM products");
    const [[{ total_orders }]]    = await pool.query("SELECT COUNT(*) AS total_orders FROM orders");
    const [[{ total_revenue }]]   = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM orders WHERE order_status <> 'cancelled'"
    );
    const [orders_by_status] = await pool.query(
      "SELECT order_status, COUNT(*) AS count FROM orders GROUP BY order_status"
    );
    res.status(200).json({
      success: true,
      report: {
        total_customers,
        total_sellers,
        total_products,
        total_orders,
        total_revenue: Number(total_revenue),
        orders_by_status
      }
    });
  } catch (err) {
    console.error("GET /api/admin/reports failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to build report" });
  }
});

// Admin: view system activity logs, with optional filters
// (?action= ?user_id= ?from= ?to= ?limit=). LEFT JOIN so a log whose
// user was later deleted (user_id set NULL) still shows.
router.get("/logs", async (req, res) => {
  const { action, user_id, from, to } = req.query;
  let limit = Number(req.query.limit) || 100;
  if (limit < 1) limit = 1;
  if (limit > 500) limit = 500;

  let sql =
    `SELECT l.log_id, l.user_id, u.name AS user_name, l.action,
            l.description, l.ip_address, l.created_at
     FROM system_logs l
     LEFT JOIN users u ON l.user_id = u.user_id
     WHERE 1 = 1`;
  const params = [];
  if (action)  { sql += " AND l.action = ?";     params.push(action); }
  if (user_id) { sql += " AND l.user_id = ?";    params.push(Number(user_id)); }
  if (from)    { sql += " AND l.created_at >= ?"; params.push(from); }
  if (to)      { sql += " AND l.created_at <= ?"; params.push(to); }
  sql += ` ORDER BY l.created_at DESC LIMIT ${limit}`;

  try {
    const [rows] = await pool.query(sql, params);
    res.status(200).json({ success: true, count: rows.length, logs: rows });
  } catch (err) {
    console.error("GET /api/admin/logs failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
});

module.exports = router;
