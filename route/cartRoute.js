import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

import {
    getCart,
    addToCart,
    incrementQuantity,
    decrementQuantity,
    deleteCartItem,
    clearCart,
} from "../controller/cartController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getCart);
router.post("/add", addToCart);
router.delete("/clear", clearCart);
router.patch("/increment/:productId", incrementQuantity);
router.patch("/decrement/:productId", decrementQuantity);
router.delete("/:productId", deleteCartItem);

export default router;