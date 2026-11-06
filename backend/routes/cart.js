// backend/routes/cart.js
// The logged-in customer's shopping cart. One cart per customer
// (created lazily); cart_items holds the lines with a price snapshot.

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Every cart route is for a logged-in customer.
router.use(authenticate, authorize("customer"));

// Find this customer's cart, creating it on first use.
async function getOrCreateCart(customerId) {
  const [rows] = await pool.query("SELECT cart_id FROM cart WHERE customer_id = ?", [customerId]);
  if (rows.length) return rows[0].cart_id;
  const [result] = await pool.query("INSERT INTO cart (customer_id) VALUES (?)", [customerId]);
  return result.insertId;
}

// Get the cart with its line items and a computed total.
router.get("/", async (req, res) => {
  try {
    const cartId = await getOrCreateCart(req.user.user_id);
    const [items] = await pool.query(
      `SELECT ci.cart_item_id, ci.product_id, p.product_name, p.image,
              ci.quantity, ci.price,
              (ci.quantity * ci.price) AS subtotal,
              p.stock_quantity, p.status
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.product_id
       WHERE ci.cart_id = ?
       ORDER BY ci.cart_item_id`,
      [cartId]
    );
    const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
    res.status(200).json({ success: true, cart_id: cartId, count: items.length, total, items });
  } catch (err) {
    console.error("GET /api/cart failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch cart" });
  }
});

// Add a product (or bump its quantity if already in the cart).
router.post("/items", async (req, res) => {
  const productId = Number(req.body?.product_id);
  const quantity = req.body?.quantity === undefined ? 1 : Number(req.body.quantity);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product_id is required" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive whole number" });
  }

  try {
    const [products] = await pool.query(
      "SELECT price, stock_quantity, status FROM products WHERE product_id = ?",
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    const product = products[0];
    if (product.status !== "active") {
      return res.status(400).json({ success: false, message: "Product is not available" });
    }
    if (product.stock_quantity < quantity) {
      return res.status(400).json({ success: false, message: "Not enough stock available" });
    }

    const cartId = await getOrCreateCart(req.user.user_id);

    // UNIQUE(cart_id, product_id) stops duplicate lines - we bump quantity instead.
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, price)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [cartId, productId, quantity, product.price]
    );
    res.status(201).json({ success: true, message: "Added to cart" });
  } catch (err) {
    console.error("POST /api/cart/items failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to add to cart" });
  }
});

// Set a line's quantity to an absolute value.
router.put("/items/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be positive (remove the item to clear it)" });
  }

  try {
    const [products] = await pool.query("SELECT stock_quantity FROM products WHERE product_id = ?", [productId]);
    if (products.length && products[0].stock_quantity < quantity) {
      return res.status(400).json({ success: false, message: "Not enough stock available" });
    }

    const cartId = await getOrCreateCart(req.user.user_id);
    const [result] = await pool.query(
      "UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?",
      [quantity, cartId, productId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }
    res.status(200).json({ success: true, message: "Cart updated" });
  } catch (err) {
    console.error("PUT /api/cart/items/:productId failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to update cart" });
  }
});

// Remove a single product from the cart.
router.delete("/items/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Valid product id is required" });
  }
  try {
    const cartId = await getOrCreateCart(req.user.user_id);
    const [result] = await pool.query(
      "DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?",
      [cartId, productId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }
    res.status(200).json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("DELETE /api/cart/items/:productId failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to remove item" });
  }
});

// Empty the whole cart.
router.delete("/", async (req, res) => {
  try {
    const cartId = await getOrCreateCart(req.user.user_id);
    await pool.query("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (err) {
    console.error("DELETE /api/cart failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to clear cart" });
  }
});

module.exports = router;
