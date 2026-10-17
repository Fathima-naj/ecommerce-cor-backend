
import mongoose from "mongoose";
import Wishlist from "../model/wishlistSchema.js";
import Product from "../model/productSchema.js";

// Get the logged-in user's wishlist
export const getWishlist = async (req, res) => {
    try {
        let wishlist = await Wishlist.findOne({
            user: req.user.id,
        }).populate("products");

        if (!wishlist) {
            wishlist = await Wishlist.create({
                user: req.user.id,
                products: [],
            });
        }

        return res.status(200).json({ wishlist });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
        });
    }
};

// Add a product to the wishlist
export const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        let wishlist = await Wishlist.findOne({
            user: req.user.id,
        });

        if (!wishlist) {
            wishlist = new Wishlist({
                user: req.user.id,
                products: [],
            });
        }

        // Avoid adding the same product twice
        if (!wishlist.products.some(
            (id) => id.toString() === productId
        )) {
            wishlist.products.push(productId);
        }

        await wishlist.save();
        await wishlist.populate("products");

        return res.status(200).json({
            message: "Product added to wishlist",
            wishlist,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
        });
    }
};

// Remove a product from the wishlist
export const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const wishlist = await Wishlist.findOne({
            user: req.user.id,
        });

        if (!wishlist) {
            return res.status(404).json({
                message: "Wishlist not found",
            });
        }

        wishlist.products = wishlist.products.filter(
            (id) => id.toString() !== productId
        );

        await wishlist.save();
        await wishlist.populate("products");

        return res.status(200).json({
            message: "Product removed from wishlist",
            wishlist,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
        });
    }
};
