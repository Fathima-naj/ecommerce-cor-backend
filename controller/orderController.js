
import mongoose from "mongoose";
import Order from "../model/orderSchema.js";
import Cart from "../model/cartSchema.js";
import Product from "../model/productSchema.js";

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
