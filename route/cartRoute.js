
import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
    getCart,
    addToCart,
    incrementQuantity,
    decrementQuantity,
    deleteCartItem,
    clearCart,
} from "../controllers/cartController.js";

const router = express.Router();

// All cart routes require login
router.use(authMiddleware);

router.get("/", getCart);
router.post("/add", addToCart);

// Keep /clear before /:productId
router.delete("/clear", clearCart);
router.patch("/increment/:productId", incrementQuantity);
router.patch("/decrement/:productId", decrementQuantity);
router.delete("/:productId", deleteCartItem);

export default router;
