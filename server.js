import express from "express"
import connectDB from "./config/db.js"
import productRoute from './route/productRoute.js'
import cors from 'cors'
import dotenv from 'dotenv'
import userRoute from './route/userRoute.js'
import cookieParser from "cookie-parser"
import cartRoute from './route/cartRoute.js'
import wishlistRoute from './route/wishlistRoute.js'

const app=express()
dotenv.config()
connectDB()
app.use(cookieParser())
app.use(cors({
    origin: process.env.BASE_URI||"http://localhost:5173",
    credentials: true
}))
app.use(express.json())

app.use('/product',productRoute)
app.use('/user',userRoute)
app.use('/cart',cartRoute)
app.use('/wishlist',wishlistRoute)

app.listen(3000,()=>{
    console.log('server running ...')
})