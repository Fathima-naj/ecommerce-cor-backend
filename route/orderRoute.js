
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/authorizeRole.js";

import {
    createOrder,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getMyOrders,
    getAllOrders,
    updateOrderStatus,
} from "../controller/orderController.js";

const router = express.Router();

// All order routes require authentication
router.use(authMiddleware);

// Customer routes
router.post("/create", createOrder);
router.post("/razorpay/create", createRazorpayOrder);
router.get("/my-orders", getMyOrders);
router.post("/razorpay/verify", verifyRazorpayPayment);
// Admin-only routes
router.get("/", authorizeRole("admin"), getAllOrders);

router.patch(
    "/:orderId/status",
    authorizeRole("admin"),
    updateOrderStatus
);

export default router;
