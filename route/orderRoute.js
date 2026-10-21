
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/authorizeRole.js";

import {
    createOrder,
    getMyOrders,
    getAllOrders,
    updateOrderStatus,
} from "../controller/orderController.js";

const router = express.Router();

// All order routes require authentication
router.use(authMiddleware);

// Customer routes
router.post("/create", createOrder);
router.get("/my-orders", getMyOrders);

// Admin-only routes
router.get("/", authorizeRole("admin"), getAllOrders);

router.patch(
    "/:orderId/status",
    authorizeRole("admin"),
    updateOrderStatus
);

export default router;
