import mongoose from 'mongoose'

const userSchema=mongoose.Schema({
    name:{
        type:String
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String
    },
    role:{
        type:String,
        enum:['user','admin'],
        default:'user'
    }
})

const User=mongoose.model('User',userSchema)
export default User