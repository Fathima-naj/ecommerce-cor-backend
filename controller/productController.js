import cloudinary from "../config/cloudinary.js";
import Product from "../model/productSchema.js"

export const  productController=async(req,res)=>{
  try{
      const {
            name,
            price,
            description,
            category,
            stock
        } = req.body;
        
        // const image = req.file;
        const images = req.files;

        if (!images || images.length === 0) {
            return res.status(400).json({
                message: "Product image is required"
            });
        }

        // const result = await cloudinary.uploader.upload(
        //     `data:${image.mimetype};base64,${image.buffer.toString("base64")}`,
        //     {
        //         folder: "products"
        //     }
        // );

        const imageUrls = [];

        for (const image of images) {
            const result = await cloudinary.uploader.upload(
                `data:${image.mimetype};base64,${image.buffer.toString("base64")}`,
                {
                    folder: "products"
                }
            );

            imageUrls.push(result.secure_url);
        }

        const product = {
            name,
            price,
            description,
            category,
            stock,
            // image: result.secure_url
            images: imageUrls
        };

    let newProduct=await Product.create(product)
    res.status(201).json({
        message:"Product added",
        newProduct
    })
  }catch(err){
       res.status(500).json({
        message:"server error",
        err:err.message
       })
  }

}

export const getProduct=async(req,res)=>{
  try {    
    let products=await Product.find()
    res.status(200).json({
        message:"Products fetched successfully",
        products
    })
  } catch (error) {
     res.status(500).json({
        message:"server error",
        error
       })
  }
}

export const getProductById=async(req,res)=>{
try {
  const {id}=req.params
const product=await Product.findById(id)

 if(!product){
      res.status(404).json({
        message:"product not found"
      })
    }

res.status(200).json({
        message:"Product fetched successfully",
        product
    })
} catch (error) {
  res.status(500).json({
        message:"server error",
        error
       })
}
}


export const updateProduct=async(req,res)=>{
  try {
    const {id}=req.params
    const product=req.body
    const updatedProduct=await Product.findByIdAndUpdate(id,product,{new:true})

    if(!updatedProduct){
      res.status(404).json({
        message:"product not found"
      })
    }

    res.status(200).json({
        message:"Product fetched successfully",
        updatedProduct
    })
  } catch (error) {
      res.status(500).json({
        message:"server error",
        error
       })
  }
}


export const deleteProduct=async(req,res)=>{
try {
    const {id}=req.params
  const deleted=await Product.findByIdAndDelete(id)
  
    if(!deleted){
      res.status(404).json({
        message:"product not found"
      })
    }

    res.status(200).json({
        message:"Product deleted successfully",
    })
} catch (error) {
   res.status(500).json({
        message:"server error",
        error
       })
}
}
