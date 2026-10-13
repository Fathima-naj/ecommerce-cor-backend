
import express from "express";
import {
    registerUser,
    loginUser,
    getProfile,
    refreshAccessToken,
    logoutUser,
} from "../controller/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const route = express.Router();

route.post("/register", registerUser);
route.post("/login", loginUser);
route.post("/refresh", refreshAccessToken);
route.post("/logout", logoutUser);
route.get("/profile", authMiddleware, getProfile);

export default route;
