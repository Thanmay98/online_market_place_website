// backend/routes/reviews.js
// Public: list a product's reviews. Customer: post a review for a
// product they've bought (one per product). Customer/admin: delete.

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public: list a product's reviews (newest first) with the average rating.
router.get("/product/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }
  try {
    const [reviews] = await pool.query(
      `SELECT r.review_id, r.customer_id, u.name AS customer_name,
              r.rating, r.comment, r.created_at
       FROM reviews r
       JOIN users u ON r.customer_id = u.user_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [productId]
    );
    const average = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    res.status(200).json({
      success: true,
      count: reviews.length,
      average_rating: Number(average.toFixed(2)),
      reviews
    });
  } catch (err) {
    console.error("GET /api/reviews/product/:productId failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

// Customer: add a review (only for a product they've actually ordered).
router.post("/", authenticate, authorize("customer"), async (req, res) => {
  const productId = Number(req.body?.product_id);
  const rating = Number(req.body?.rating);
  const comment = req.body?.comment || null;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product_id is required" });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "Rating must be a whole number from 1 to 5" });
  }

  try {
    // Enforce "review only what you bought" against order history.
    const [bought] = await pool.query(
      `SELECT 1 FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE o.customer_id = ? AND oi.product_id = ?
       LIMIT 1`,
      [req.user.user_id, productId]
    );
    if (bought.length === 0) {
      return res.status(403).json({ success: false, message: "You can only review products you have purchased" });
    }

    const [result] = await pool.query(
      "INSERT INTO reviews (customer_id, product_id, rating, comment) VALUES (?, ?, ?, ?)",
      [req.user.user_id, productId, rating, comment]
    );
    res.status(201).json({ success: true, message: "Review added", review_id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "You have already reviewed this product" });
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2" || err.errno === 1452) {
      return res.status(400).json({ success: false, message: "Product does not exist" });
    }
    console.error("POST /api/reviews failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to add review" });
  }
});

// Customer (own) / admin: delete a review.
router.delete("/:id", authenticate, authorize("customer", "admin", "superadmin"), async (req, res) => {
  const reviewId = Number(req.params.id);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return res.status(400).json({ success: false, message: "Valid review id is required" });
  }
  try {
    const [rows] = await pool.query("SELECT customer_id FROM reviews WHERE review_id = ?", [reviewId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (req.user.role === "customer" && rows[0].customer_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "You can only delete your own review" });
    }
    await pool.query("DELETE FROM reviews WHERE review_id = ?", [reviewId]);
    res.status(200).json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("DELETE /api/reviews/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete review" });
  }
});

module.exports = router;
