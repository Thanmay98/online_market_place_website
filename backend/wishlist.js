
const products = require("./products");

// Temporary in-memory wishlist
let wishlist = [];

// Get all wishlist products
function getWishlist() {
    return products.filter(product =>
        wishlist.includes(product.id)
    );
}

// Add a product to wishlist
function addToWishlist(productId) {
    const product = products.find(p => p.id === productId);

    if (!product) {
        return { error: "Product not found", status: 404 };
    }

    if (wishlist.includes(productId)) {
        return { error: "Product already in wishlist", status: 409 };
    }

    wishlist.push(productId);

    return { success: true, product };
}

// Remove a product from wishlist
function removeFromWishlist(productId) {
    if (!wishlist.includes(productId)) {
        return { error: "Product not in wishlist", status: 404 };
    }

    wishlist = wishlist.filter(id => id !== productId);

    return { success: true, message: "Product removed from wishlist" };
}

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
