// backend/routes/categories.js
// Public listing + admin-only create/update/delete.

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public: list all categories (frontend uses this for filters/dropdowns).
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT category_id, category_name, description, status FROM categories ORDER BY category_name"
    );
    res.status(200).json({ success: true, count: rows.length, categories: rows });
  } catch (err) {
    console.error("GET /api/categories failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
});

// Admin: create a category.
router.post("/", authenticate, authorize("admin", "superadmin"), async (req, res) => {
  const { category_name, description } = req.body || {};

  if (!category_name) {
    return res.status(400).json({ success: false, message: "Category name is required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO categories (category_name, description) VALUES (?, ?)",
      [category_name, description || null]
    );
    res.status(201).json({
      success: true,
      message: "Category created",
      category: { category_id: result.insertId, category_name, description: description || null, status: "active" }
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    console.error("POST /api/categories failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
});

// Admin: update a category (name / description / status). Only the
// fields provided are changed (COALESCE keeps the rest as-is).
router.put("/:id", authenticate, authorize("admin", "superadmin"), async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: "Valid category id is required" });
  }

  const { category_name, description, status } = req.body || {};
  if (status && !["active", "inactive"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be active or inactive" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE categories
       SET category_name = COALESCE(?, category_name),
           description   = COALESCE(?, description),
           status        = COALESCE(?, status)
       WHERE category_id = ?`,
      [category_name || null, description ?? null, status || null, categoryId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.status(200).json({ success: true, message: "Category updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    console.error("PUT /api/categories/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to update category" });
  }
});

// Admin: delete a category. Blocked by the schema if products still
// reference it (FK RESTRICT) -> we return a clear message to disable instead.
router.delete("/:id", authenticate, authorize("admin", "superadmin"), async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: "Valid category id is required" });
  }

  try {
    const [result] = await pool.query("DELETE FROM categories WHERE category_id = ?", [categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451) {
      return res.status(409).json({
        success: false,
        message: "Category has products and can't be deleted - set it inactive instead"
      });
    }
    console.error("DELETE /api/categories/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
});

module.exports = router;
