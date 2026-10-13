import bcrypt from "bcrypt"
import User from "../model/userSchema.js";
import jwt from 'jsonwebtoken'


export const registerUser = async (req, res) => {
    try {

        const { name, email, password ,role} = req.body;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await newUser.save();

        res.status(201).json({
            message: "User registered successfully",
            newUser
        });

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }
};

export const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid password"
            });
        }
         
        const accessToken=jwt.sign({id:user._id , email:user.email,role:user.role},process.env.JWT_ACCESS_SECRET,{expiresIn:"15m"})
        const refreshToken=jwt.sign({id:user._id , email:user.email,role:user.role},process.env.JWT_REFRESH_SECRET,{expiresIn:"7d"})

        res.cookie('accessToken',accessToken,{
            httpOnly:true,
            secure:false,
            maxAge:15*60*1000
        })

        res.cookie('refreshToken',refreshToken,{
            httpOnly:true,
            secure:false,
            maxAge:7*24*60*60*1000
        })

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role:user.role
            }
        });

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }

};


export const getProfile=async(req,res)=>{
    res.status(200).json({
        message:"profile fetched",
        user:req.user
    })
}




const cookieOptions = {
    httpOnly: true,
    secure: false,
  
};

const setAuthCookies = (res, user) => {
    const accessToken = jwt.sign(
        {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
        { id: user._id.toString() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );

    res.cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

const clearAuthCookies = (res) => {
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
};

export const refreshAccessToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;

        if (!token) {
            return res.status(401).json({
                message: "Refresh token required",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET
        );

        const user = await User.findById(decoded.id);

        if (!user) {
            clearAuthCookies(res);

            return res.status(401).json({
                message: "Session is no longer valid",
            });
        }

        // Issue new access and refresh cookies.
        setAuthCookies(res, user);

        return res.status(200).json({
            message: "Token refreshed successfully",
        });
    } catch (error) {
        clearAuthCookies(res);

        return res.status(401).json({
            message: "Refresh token is invalid or expired",
        });
    }
};

export const logoutUser = (req, res) => {
    clearAuthCookies(res);

    return res.status(200).json({
        message: "Logged out successfully",
    });
};
