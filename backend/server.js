
const express = require("express");
const cors = require("cors");

const products = require("./products");

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

// Get all products
app.get("/api/products", (req, res) => {
    res.status(200).json({
        success: true,
        count: products.length,
        products: products
    });
});

// Get product details
app.get("/api/products/:id", (req, res) => {
    const productId = Number(req.params.id);

    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.status(404).json({
            success: false,
            message: "Product not found"
        });
    }

    res.status(200).json({
        success: true,
        product: product
    });
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
