
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

const products = require("./products");

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

// Get product by ID
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

app.listen(PORT, () => {
    console.log(`Marketly API running at http://localhost:${PORT}`);
});
