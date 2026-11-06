// backend/routes/orders.js
// Checkout (cart -> order), customer order history/cancel, and the
// seller/admin side (view orders for their products, update status).

const express = require("express");
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const VALID_STATUS = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

// --- Customer: place an order from the cart (transactional checkout) ---
router.post("/", authorize("customer"), async (req, res) => {
  const shippingAddress = (req.body?.shipping_address || "").trim();
  if (!shippingAddress) {
    return res.status(400).json({ success: false, message: "shipping_address is required" });
  }

  try {
    // Load cart + items with CURRENT product data (price/stock/seller).
    const [carts] = await pool.query("SELECT cart_id FROM cart WHERE customer_id = ?", [req.user.user_id]);
    if (carts.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }
    const cartId = carts[0].cart_id;

    const [items] = await pool.query(
      `SELECT ci.product_id, ci.quantity, p.price, p.seller_id,
              p.stock_quantity, p.status, p.product_name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    // Pre-check availability so we fail cleanly before the transaction.
    for (const it of items) {
      if (it.status !== "active") {
        return res.status(400).json({ success: false, message: `"${it.product_name}" is no longer available` });
      }
      if (it.stock_quantity < it.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for "${it.product_name}"` });
      }
    }

    const total = items.reduce((sum, it) => sum + it.quantity * Number(it.price), 0);

    // Everything below is all-or-nothing.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orderResult] = await conn.query(
        `INSERT INTO orders (customer_id, total_amount, shipping_address, order_status, payment_status)
         VALUES (?, ?, ?, 'pending', 'pending')`,
        [req.user.user_id, total, shippingAddress]
      );
      const orderId = orderResult.insertId;

      for (const it of items) {
        const subtotal = it.quantity * Number(it.price);
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, seller_id, quantity, price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, it.product_id, it.seller_id, it.quantity, it.price, subtotal]
        );
        // Decrement stock, guarding against a concurrent oversell.
        const [upd] = await conn.query(
          "UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ? AND stock_quantity >= ?",
          [it.quantity, it.product_id, it.quantity]
        );
        if (upd.affectedRows === 0) {
          throw new Error(`Stock changed for "${it.product_name}"`);
        }
      }

      await conn.query("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);

      await conn.commit();
      res.status(201).json({ success: true, message: "Order placed", order_id: orderId, total_amount: total });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("POST /api/orders failed:", err.message);
    res.status(500).json({ success: false, message: "Checkout failed - no changes were made" });
  }
});

// --- Customer: list own orders ---
router.get("/", authorize("customer"), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.order_id, o.total_amount, o.shipping_address, o.order_status,
              o.payment_status, o.order_date, COUNT(oi.order_item_id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.customer_id = ?
       GROUP BY o.order_id
       ORDER BY o.order_date DESC`,
      [req.user.user_id]
    );
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error("GET /api/orders failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// --- Seller/admin: orders containing the seller's products (admin sees all) ---
// Declared before "/:id" so "seller" isn't captured as an id.
router.get("/seller", authorize("seller", "admin", "superadmin"), async (req, res) => {
  try {
    let rows;
    if (req.user.role === "seller") {
      [rows] = await pool.query(
        `SELECT oi.order_item_id, oi.order_id, o.order_status, o.order_date, o.shipping_address,
                oi.product_id, p.product_name, oi.quantity, oi.price, oi.subtotal
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         JOIN products p ON oi.product_id = p.product_id
         WHERE oi.seller_id = ?
         ORDER BY o.order_date DESC`,
        [req.user.user_id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT oi.order_item_id, oi.order_id, o.order_status, o.order_date,
                oi.seller_id, oi.product_id, p.product_name, oi.quantity, oi.price, oi.subtotal
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         JOIN products p ON oi.product_id = p.product_id
         ORDER BY o.order_date DESC`
      );
    }
    res.status(200).json({ success: true, count: rows.length, items: rows });
  } catch (err) {
    console.error("GET /api/orders/seller failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// --- Order detail (customer sees own; seller if they have a line; admin any) ---
router.get("/:id", async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: "Valid order id is required" });
  }
  try {
    const [orders] = await pool.query("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = orders[0];

    if (req.user.role === "customer" && order.customer_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (req.user.role === "seller") {
      const [cnt] = await pool.query(
        "SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND seller_id = ?",
        [orderId, req.user.user_id]
      );
      if (cnt[0].c === 0) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const [items] = await pool.query(
      `SELECT oi.order_item_id, oi.product_id, p.product_name, oi.seller_id,
              oi.quantity, oi.price, oi.subtotal
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    res.status(200).json({ success: true, order, items });
  } catch (err) {
    console.error("GET /api/orders/:id failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
});

// --- Customer: cancel an eligible order (restores stock) ---
router.put("/:id/cancel", authorize("customer"), async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: "Valid order id is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      "SELECT customer_id, order_status FROM orders WHERE order_id = ? FOR UPDATE",
      [orderId]
    );
    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = orders[0];
    if (order.customer_id !== req.user.user_id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (!["pending", "confirmed"].includes(order.order_status)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Cannot cancel an order that is ${order.order_status}` });
    }

    // Put the stock back.
    const [lines] = await conn.query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]);
    for (const l of lines) {
      await conn.query("UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?", [l.quantity, l.product_id]);
    }
    await conn.query("UPDATE orders SET order_status = 'cancelled' WHERE order_id = ?", [orderId]);

    await conn.commit();
    res.status(200).json({ success: true, message: "Order cancelled" });
  } catch (err) {
    await conn.rollback();
    console.error("PUT /api/orders/:id/cancel failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to cancel order" });
  } finally {
    conn.release();
  }
});

// --- Seller (own order lines) / admin: update order status ---
router.put("/:id/status", authorize("seller", "admin", "superadmin"), async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: "Valid order id is required" });
  }

  const status = req.body?.order_status;
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ success: false, message: `order_status must be one of: ${VALID_STATUS.join(", ")}` });
  }

  try {
    const [orders] = await pool.query("SELECT order_id FROM orders WHERE order_id = ?", [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // A seller can only touch orders that include their products.
    if (req.user.role === "seller") {
      const [cnt] = await pool.query(
        "SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND seller_id = ?",
        [orderId, req.user.user_id]
      );
      if (cnt[0].c === 0) {
        return res.status(403).json({ success: false, message: "This order has none of your products" });
      }
    }

    await pool.query("UPDATE orders SET order_status = ? WHERE order_id = ?", [status, orderId]);
    res.status(200).json({ success: true, message: "Order status updated" });
  } catch (err) {
    console.error("PUT /api/orders/:id/status failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to update order status" });
  }
});

module.exports = router;
