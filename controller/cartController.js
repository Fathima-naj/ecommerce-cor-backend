
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Get cart
export const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({
                user: req.user._id,
                items: [],
            });
        }

        await cart.populate("items.product");

        res.status(200).json({ cart });      
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add to cart
export const addToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const quantity = req.body.quantity || 1;

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        const item = cart.items.find(
            (item) => item.product.toString() === productId
        );

        if (item) {
            item.quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity });
        }

        if (cart.items.find(
            (item) => item.product.toString() === productId
        ).quantity > product.stock) {
            return res.status(400).json({ message: "Not enough stock" });
        }

        await cart.save();
        await cart.populate("items.product");

        res.status(200).json({ message: "Added to cart", cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Increase quantity
export const incrementQuantity = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        const item = cart?.items.find(
            (item) => item.product.toString() === req.params.productId
        );

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        item.quantity += 1;
        await cart.save();
        await cart.populate("items.product");

        res.status(200).json({ cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Decrease quantity
export const decrementQuantity = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        const item = cart?.items.find(
            (item) => item.product.toString() === req.params.productId
        );

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        if (item.quantity > 1) {
            item.quantity -= 1;
        }

        await cart.save();
        await cart.populate("items.product");

        res.status(200).json({ cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete one item
export const deleteCartItem = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== req.params.productId
        );

        await cart.save();
        await cart.populate("items.product");

        res.status(200).json({ message: "Item removed", cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Clear cart
export const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.items = [];
        await cart.save();

        res.status(200).json({ message: "Cart cleared", cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};