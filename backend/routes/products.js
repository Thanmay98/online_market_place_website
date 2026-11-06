// backend/routes/products.js
// Public browsing (list + details) and seller/admin management
// (create, update, delete, plus a seller's own-products list).

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

const SELECT_FIELDS = `
  p.product_id, p.seller_id, p.category_id, c.category_name,
  p.product_name, p.description, p.price, p.stock_quantity,
  p.image, p.status, p.created_at`;

// Public: list all products (with category name).
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM products p
       JOIN categories c ON p.category_id = c.category_id
       ORDER BY p.product_id`
    );
    res.status(200).json({ success: true, count: rows.length, products: rows });
  } catch (err) {
    console.error("GET /api/products failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

// Seller/admin: list the logged-in seller's own products.
// Declared before "/:id" so "mine" isn't captured as an id.
router.get("/mine", authenticate, authorize("seller", "admin", "superadmin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM products p
       JOIN categories c ON p.category_id = c.category_id
       WHERE p.seller_id = ?
       ORDER BY p.product_id`,
      [req.user.user_id]
    );
    res.status(200).json({ success: true, count: rows.length, products: rows });
  } catch (err) {
    console.error("GET /api/products/mine failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

// Seller/admin: create a product.
router.post("/", authenticate, authorize("seller", "admin", "superadmin"), async (req, res) => {
  const { category_id, product_name, description, price, stock_quantity, image } = req.body || {};

  // A seller owns the products they create; an admin must name the seller.
  let sellerId;
  if (req.user.role === "seller") {
    sellerId = req.user.user_id;
  } else {
    sellerId = Number(req.body.seller_id);
    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({ success: false, message: "seller_id is required when an admin creates a product" });
    }
  }

  if (!product_name || !category_id || price === undefined) {
    return res.status(400).json({ success: false, message: "product_name, category_id and price are required" });
  }
  if (Number(price) < 0 || (stock_quantity !== undefined && Number(stock_quantity) < 0)) {
    return res.status(400).json({ success: false, message: "price and stock cannot be negative" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO products (seller_id, category_id, product_name, description, price, stock_quantity, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sellerId, category_id, product_name, description || null, price, stock_quantity || 0, image || null]
    );
    res.status(201).json({ success: true, message: "Product created", product_id: result.insertId });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2" || err.errno === 1452) {
      return res.status(400).json({ success: false, message: "category_id or seller_id does not exist" });
    }
    console.error("POST /api/products failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to create product" });
  }
});

// Public: product details. Declared after the static routes above.
router.get("/:id", async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM products p
       JOIN categories c ON p.category_id = c.category_id
       WHERE p.product_id = ?`,
      [productId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, product: rows[0] });
  } catch (err) {
    console.error("GET /api/products/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

// Seller (own) / admin: update a product. COALESCE updates only the
// fields sent, so editing stock alone leaves everything else intact.
router.put("/:id", authenticate, authorize("seller", "admin", "superadmin"), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }

  const { category_id, product_name, description, price, stock_quantity, image, status } = req.body || {};
  if (status && !["active", "inactive"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be active or inactive" });
  }

  try {
    const [existing] = await pool.query("SELECT seller_id FROM products WHERE product_id = ?", [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (req.user.role === "seller" && existing[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "You can only edit your own products" });
    }

    await pool.query(
      `UPDATE products
       SET category_id    = COALESCE(?, category_id),
           product_name   = COALESCE(?, product_name),
           description    = COALESCE(?, description),
           price          = COALESCE(?, price),
           stock_quantity = COALESCE(?, stock_quantity),
           image          = COALESCE(?, image),
           status         = COALESCE(?, status)
       WHERE product_id = ?`,
      [category_id ?? null, product_name || null, description ?? null,
       price ?? null, stock_quantity ?? null, image ?? null, status || null, productId]
    );
    res.status(200).json({ success: true, message: "Product updated" });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2" || err.errno === 1452) {
      return res.status(400).json({ success: false, message: "category_id does not exist" });
    }
    console.error("PUT /api/products/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
});

// Seller (own) / admin: delete a product.
router.delete("/:id", authenticate, authorize("seller", "admin", "superadmin"), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }
  try {
    const [existing] = await pool.query("SELECT seller_id FROM products WHERE product_id = ?", [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (req.user.role === "seller" && existing[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "You can only delete your own products" });
    }

    await pool.query("DELETE FROM products WHERE product_id = ?", [productId]);
    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451) {
      return res.status(409).json({ success: false, message: "Product is part of existing orders - set it inactive instead" });
    }
    console.error("DELETE /api/products/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete product" });
  }
});

module.exports = router;
