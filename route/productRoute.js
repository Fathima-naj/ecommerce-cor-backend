import express from "express"
import { deleteProduct, getProduct, getProductById, productController, updateProduct } from "../controller/productController.js"
import upload from "../middleware/uploadMiddleware.js"
import authorizeRole from "../middleware/authorizeRole.js"
import { authMiddleware } from "../middleware/authMiddleware.js"


const route=express.Router()

route.post('/add',authMiddleware,authorizeRole('admin'),upload.array("images", 5) ,productController)
route.get('/',getProduct)
route.get('/:id',getProductById)
route.put('/update/:id',authMiddleware,authorizeRole('admin'),updateProduct)     
route.delete('/delete/:id',authMiddleware,authorizeRole('admin'),deleteProduct)

export default route 