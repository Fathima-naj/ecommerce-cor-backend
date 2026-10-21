
import mongoose from "mongoose";

const paymentAttemptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
                image: {
                    type: String,
                    default: "",
                },
                price: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
            },
        ],

        shippingAddress: {
            fullName: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true },
            address: { type: String, required: true, trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            pincode: { type: String, required: true, trim: true },
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
        },

        status: {
    type: String,
    enum: ["Created", "Processing", "Paid", "Failed"],
    default: "Created",
},

        razorpayPaymentId: {
            type: String,
            default: null,
        },
        order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
},
    },
    { timestamps: true }
);

const PaymentAttempt = mongoose.model(
    "PaymentAttempt",
    paymentAttemptSchema
);

export default PaymentAttempt;
