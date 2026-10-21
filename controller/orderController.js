
import mongoose from "mongoose";
import Order from "../model/orderSchema.js";
import Cart from "../model/cartSchema.js";
import Product from "../model/productSchema.js";
import razorpay from "../config/razorpay.js";
import PaymentAttempt from "../model/paymentAttemptSchema.js";

import crypto from "crypto";

// Create an order from the logged-in user's cart

export const createOrder = async (req, res) => {
    const reservedItems = [];
    let orderSaved = false;

    try {
        const { fullName, phone, address, city, state, pincode } =
            req.body;

        // 1. Validate the delivery address
        if (
            !fullName?.trim() ||
            !phone?.trim() ||
            !address?.trim() ||
            !city?.trim() ||
            !state?.trim() ||
            !pincode?.trim()
        ) {
            return res.status(400).json({
                message: "Please provide all delivery details",
            });
        }

        if (!/^\d{10}$/.test(phone.trim())) {
            return res.status(400).json({
                message: "Enter a valid 10-digit phone number",
            });
        }

        if (!/^\d{6}$/.test(pincode.trim())) {
            return res.status(400).json({
                message: "Enter a valid 6-digit PIN code",
            });
        }

        // 2. Get the logged-in user's cart
        const cart = await Cart.findOne({
            user: req.user.id,
        }).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty",
            });
        }

        const orderItems = [];
        let totalAmount = 0;

        // 3. Validate products, quantities and prices
        for (const item of cart.items) {
            const product = item.product;

            if (!product) {
                return res.status(400).json({
                    message: "A product in your cart no longer exists",
                });
            }

            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    message: "Invalid product quantity",
                });
            }

            if (
                !Number.isFinite(product.price) ||
                product.price < 0
            ) {
                return res.status(400).json({
                    message: `Invalid price for ${product.name}`,
                });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.name}`,
                });
            }

            orderItems.push({
                product: product._id,
                name: product.name,
                image: product.images?.[0] || "",
                price: product.price,
                quantity: item.quantity,
            });

            totalAmount += product.price * item.quantity;
        }

        // 4. Reserve stock using conditional updates
        // This prevents stock from becoming negative.
        for (const item of orderItems) {
            const updatedProduct = await Product.findOneAndUpdate(
                {
                    _id: item.product,
                    stock: { $gte: item.quantity },
                },
                {
                    $inc: { stock: -item.quantity },
                },
                {
                    new: true,
                }
            );

            if (!updatedProduct) {
                const error = new Error(
                    `Stock changed while ordering ${item.name}. Please try again.`
                );
                error.statusCode = 400;
                throw error;
            }

            // Record successful deductions for possible recovery.
            reservedItems.push({
                productId: item.product,
                quantity: item.quantity,
            });
        }

        // 5. Create the order
        const createdOrder = await Order.create({
            user: req.user.id,
            items: orderItems,
            shippingAddress: {
                fullName: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                city: city.trim(),
                state: state.trim(),
                pincode: pincode.trim(),
            },
            totalAmount,
            paymentMethod: "COD",
            paymentStatus: "Pending",
            orderStatus: "Processing",
        });

        orderSaved = true;

        // 6. Clear the cart only after the order is saved
        try {
            cart.items = [];
            await cart.save();
        } catch (cartError) {
            // The order already exists, so do not restore its stock.
            console.error(
                "Order saved, but cart could not be cleared:",
                cartError
            );

            return res.status(201).json({
                message:
                    "Order placed successfully, but your cart could not be cleared. Please refresh your cart.",
                order: createdOrder,
            });
        }

        return res.status(201).json({
            message: "Order placed successfully",
            order: createdOrder,
        });
    } catch (error) {
        console.error("Create order error:", error);

        // 7. Restore stock if order creation failed
        // Never restore stock after the order has been saved.
        if (!orderSaved) {
            for (const item of [...reservedItems].reverse()) {
                try {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { stock: item.quantity } }
                    );
                } catch (rollbackError) {
                    console.error(
                        "Stock restoration failed:",
                        item.productId,
                        rollbackError
                    );
                }
            }
        }

        return res.status(error.statusCode || 500).json({
            message:
                error.statusCode && error.statusCode < 500
                    ? error.message
                    : "Unable to place order. Please try again.",
        });
    }
};


export const createRazorpayOrder = async (req, res) => {
    try {
        const {
            fullName,
            phone,
            address,
            city,
            state,
            pincode,
        } = req.body;

        // 1. Validate shipping details
        if (
            !fullName?.trim() ||
            !phone?.trim() ||
            !address?.trim() ||
            !city?.trim() ||
            !state?.trim() ||
            !pincode?.trim()
        ) {
            return res.status(400).json({
                message: "Please provide all delivery details",
            });
        }

        if (!/^\d{10}$/.test(phone.trim())) {
            return res.status(400).json({
                message: "Enter a valid 10-digit phone number",
            });
        }

        if (!/^\d{6}$/.test(pincode.trim())) {
            return res.status(400).json({
                message: "Enter a valid 6-digit PIN code",
            });
        }

        // 2. Get the logged-in user's cart
        const cart = await Cart.findOne({
            user: req.user.id,
        }).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty",
            });
        }

        // 3. Calculate the amount using database prices
        const orderItems = [];
        let totalAmount = 0;

        for (const item of cart.items) {
            const product = item.product;

            if (!product) {
                return res.status(400).json({
                    message: "A product in your cart no longer exists",
                });
            }

            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    message: "Invalid product quantity",
                });
            }

            if (
                !Number.isFinite(product.price) ||
                product.price <= 0
            ) {
                return res.status(400).json({
                    message: `Invalid price for ${product.name}`,
                });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.name}`,
                });
            }

            orderItems.push({
                product: product._id,
                name: product.name,
                image: product.images?.[0] || "",
                price: product.price,
                quantity: item.quantity,
            });

            totalAmount += product.price * item.quantity;
        }

        // Convert rupees to paise
        const amountInPaise = Math.round(totalAmount * 100);

        if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({
                message: "The payment amount is invalid",
            });
        }

        // 4. Create an order with Razorpay
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `gf_${Date.now()}`,
        });

        // 5. Save the server-side payment attempt
        const paymentAttempt = await PaymentAttempt.create({
            user: req.user.id,
            items: orderItems,
            shippingAddress: {
                fullName: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                city: city.trim(),
                state: state.trim(),
                pincode: pincode.trim(),
            },
            totalAmount,
            razorpayOrderId: razorpayOrder.id,
            status: "Created",
        });

        // 6. Return only the details needed by the frontend
        return res.status(201).json({
            message: "Payment order created successfully",
            key: process.env.RAZORPAY_KEY_ID,
            paymentAttemptId: paymentAttempt._id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
        });
    } catch (error) {
        console.error("Create Razorpay order error:", error);

        return res.status(500).json({
            message: "Unable to initialize payment. Please try again.",
        });
    }
};


export const verifyRazorpayPayment = async (req, res) => {
    const reservedItems = [];
    let orderSaved = false;
    let attempt = null;

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                message: "Payment verification details are missing",
            });
        }

        // 1. Find this payment attempt for the logged-in user
        attempt = await PaymentAttempt.findOne({
            razorpayOrderId: razorpay_order_id,
            user: req.user.id,
        });

        if (!attempt) {
            return res.status(404).json({
                message: "Payment attempt not found",
            });
        }

        // 2. Make repeated successful requests idempotent
        if (attempt.status === "Paid" && attempt.order) {
            const existingOrder = await Order.findById(attempt.order);

            if (existingOrder) {
                return res.status(200).json({
                    message: "Payment already verified",
                    order: existingOrder,
                });
            }

            return res.status(409).json({
                message: "Payment was recorded but the order needs recovery",
            });
        }

        if (attempt.status !== "Created") {
            return res.status(409).json({
                message: "This payment attempt is already being processed",
            });
        }

        // 3. Verify the Razorpay signature using the SERVER secret
        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${attempt.razorpayOrderId}|${razorpay_payment_id}`
            )
            .digest("hex");

        const received = Buffer.from(razorpay_signature, "hex");
        const expected = Buffer.from(expectedSignature, "hex");

        if (
            received.length !== expected.length ||
            !crypto.timingSafeEqual(received, expected)
        ) {
            return res.status(400).json({
                message: "Invalid payment signature",
            });
        }

        // 4. Confirm payment details directly with Razorpay
        const payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        if (
            payment.order_id !== attempt.razorpayOrderId ||
            payment.status !== "captured" ||
            payment.amount !== Math.round(attempt.totalAmount * 100) ||
            payment.currency !== "INR"
        ) {
            return res.status(400).json({
                message:
                    "Payment is not captured or its details do not match",
            });
        }

        // 5. Claim the attempt so concurrent requests cannot both proceed
        const claimedAttempt = await PaymentAttempt.findOneAndUpdate(
            {
                _id: attempt._id,
                status: "Created",
            },
            {
                $set: { status: "Processing" },
            },
            { new: true }
        );

        if (!claimedAttempt) {
            return res.status(409).json({
                message: "This payment attempt is already being processed",
            });
        }

        attempt = claimedAttempt;

        // 6. Reserve stock from the saved payment snapshot
        for (const item of attempt.items) {
            const updatedProduct = await Product.findOneAndUpdate(
                {
                    _id: item.product,
                    stock: { $gte: item.quantity },
                },
                {
                    $inc: { stock: -item.quantity },
                },
                { new: true }
            );

            if (!updatedProduct) {
                const error = new Error(
                    `Insufficient stock for ${item.name}. Contact support for payment assistance.`
                );
                error.statusCode = 409;
                throw error;
            }

            reservedItems.push({
                productId: item.product,
                quantity: item.quantity,
            });
        }

        // 7. Create the paid order from the server-saved snapshot
        const createdOrder = await Order.create({
            user: attempt.user,
            items: attempt.items,
            shippingAddress: attempt.shippingAddress,
            totalAmount: attempt.totalAmount,
            paymentMethod: "Razorpay",
            paymentStatus: "Paid",
            orderStatus: "Processing",
        });

        orderSaved = true;

        // 8. Link payment attempt and final order
        attempt.status = "Paid";
        attempt.razorpayPaymentId = razorpay_payment_id;
        attempt.order = createdOrder._id;
        await attempt.save();

        // 9. Clear the user's cart only after order creation
        try {
            const cart = await Cart.findOne({ user: req.user.id });

            if (cart) {
                // Clear only if the cart still matches the purchased items.
                const currentItems = cart.items.map((item) => ({
                    product: String(item.product),
                    quantity: item.quantity,
                }));

                const purchasedItems = attempt.items.map((item) => ({
                    product: String(item.product),
                    quantity: item.quantity,
                }));

                const sameCart =
                    currentItems.length === purchasedItems.length &&
                    purchasedItems.every((item) =>
                        currentItems.some(
                            (current) =>
                                current.product === item.product &&
                                current.quantity === item.quantity
                        )
                    );

                if (sameCart) {
                    cart.items = [];
                    await cart.save();
                }
            }
        } catch (cartError) {
            console.error("Order saved but cart cleanup failed:", cartError);
        }

        return res.status(201).json({
            message: "Payment verified and order placed successfully",
            order: createdOrder,
        });
    } catch (error) {
        console.error("Razorpay verification error:", error);

        // Restore any stock deductions if order creation failed
        if (!orderSaved) {
            for (const item of [...reservedItems].reverse()) {
                try {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { stock: item.quantity } }
                    );
                } catch (rollbackError) {
                    console.error(
                        "Stock restoration failed:",
                        rollbackError
                    );
                }
            }

            if (attempt?.status === "Processing") {
                try {
                    attempt.status = "Created";
                    await attempt.save();
                } catch (resetError) {
                    console.error(
                        "Could not reset payment attempt:",
                        resetError
                    );
                }
            }
        }

        return res.status(error.statusCode || 500).json({
            message:
                error.statusCode && error.statusCode < 500
                    ? error.message
                    : "Unable to verify payment. Please contact support if money was deducted.",
        });
    }
};

// Get the logged-in customer's orders
export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user.id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({ orders });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch your orders",
        });
    }
};

// Admin: get all orders
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({ orders });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch orders",
        });
    }
};

// Admin: update order status
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus } = req.body;

        const allowedStatuses = [
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled",
        ];

        if (!mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({
                message: "Invalid order ID",
            });
        }

        if (!allowedStatuses.includes(orderStatus)) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        if (
            order.orderStatus === "Delivered" ||
            order.orderStatus === "Cancelled"
        ) {
            return res.status(400).json({
                message: "This order is already finalized",
            });
        }

        order.orderStatus = orderStatus;
        await order.save();

        return res.status(200).json({
            message: "Order status updated successfully",
            order,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update order status",
        });
    }
};
