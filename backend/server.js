
const express = require("express");
const cors = require("cors");

const pool = require("./db");

const {
    getWishlist,
    addToWishlist,
    removeFromWishlist
} = require("./wishlist");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Marketly backend is running"
    });
});

// Get all products (from the MySQL `products` table, with category name)
app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.product_id, p.seller_id, p.category_id, c.category_name,
                    p.product_name, p.description, p.price, p.stock_quantity,
                    p.image, p.status, p.created_at
             FROM products p
             JOIN categories c ON p.category_id = c.category_id
             ORDER BY p.product_id`
        );

        res.status(200).json({
            success: true,
            count: rows.length,
            products: rows
        });
    } catch (err) {
        console.error("GET /api/products failed:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
});

// Get product details
app.get("/api/products/:id", async (req, res) => {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Valid product id is required"
        });
    }

    try {
        const [rows] = await pool.query(
            `SELECT p.product_id, p.seller_id, p.category_id, c.category_name,
                    p.product_name, p.description, p.price, p.stock_quantity,
                    p.image, p.status, p.created_at
             FROM products p
             JOIN categories c ON p.category_id = c.category_id
             WHERE p.product_id = ?`,
            [productId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            product: rows[0]
        });
    } catch (err) {
        console.error("GET /api/products/:id failed:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product"
        });
    }
});

// Get wishlist
app.get("/api/wishlist", (req, res) => {
    const wishlistProducts = getWishlist();

    res.status(200).json({
        success: true,
        count: wishlistProducts.length,
        products: wishlistProducts
    });
});

// Add product to wishlist
app.post("/api/wishlist", (req, res) => {
    const productId = Number(req.body?.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Valid productId is required"
        });
    }

    const result = addToWishlist(productId);

    if (result.error) {
        return res.status(result.status).json({
            success: false,
            message: result.error
        });
    }

    res.status(201).json(result);
});

// Remove product from wishlist
app.delete("/api/wishlist/:id", (req, res) => {
    const productId = Number(req.params.id);

    const result = removeFromWishlist(productId);

    if (result.error) {
        return res.status(result.status).json({
            success: false,
            message: result.error
        });
    }

    res.status(200).json(result);
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

app.listen(PORT, () => {
    console.log(`Marketly API running at http://localhost:${PORT}`);
});
