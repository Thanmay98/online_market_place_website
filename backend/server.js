
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const reviewRoutes = require("./routes/reviews");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);

// Serve the frontend (HTML/CSS/JS at the project root) so pages load
// from http://localhost:3000 and their fetch('/api/...') calls are
// same-origin. express.static's default dotfiles:"ignore" means .env
// and .git are never served.
app.use(express.static(path.join(__dirname, "..")));

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Marketly backend is running"
    });
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
