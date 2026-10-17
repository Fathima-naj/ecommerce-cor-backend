
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
} from "../controller/wishlistController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;
