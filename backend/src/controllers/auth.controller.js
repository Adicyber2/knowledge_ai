// import userModel from "../models/user.model.js "
// import jwt from "jsonwebtoken"
// import {config} from "../config/config.js"

// async function sendTokenResponse(user,res,message){

//     const token=jwt.sign({
//         id:user._id
//     },config.JWT_SECRET,{
//         expiresIn:"7d"
//     })

//     res.cookie("token",token)

//     res.status(200).json({
//         message,
//         succcess:true,
//         token,
//         user:{
//             id:user._id,
//             email:user.email,
//             contact:user.contact,
//             fullname:user.fullname,
//             role:user.role
//         }
//     })
// }


// export const register=async (req,res)=>{

//     const {email,password,contact,fullname,isSeller}=req.body

//     try{
//         const  existingUser = await userModel.findOne({
//             $or:[
//                 {email},{contact}
//             ]
//         })

//         if(existingUser){
//             return res.status(400).json({message:"User whit this email or contact already exists"})
//         }

//         const user = await userModel.create({
//             email,
//             password,
//             contact,
//             fullname,
//             role:isSeller ? "seller" : "buyer"
            
//         })


//         await sendTokenResponse(user,res),"User registered successfully"

//     }catch(error){
//         console.log(error);

//         return res.status(500).json({message:"Server Error"})
        
//     }
// }


// export const login = async (req,res)=>{

//     const {email,password} = req.body

//     const user = await userModel.findOne({email})

//     if(!user){
//         return res.status(400).josn({message:"Invalid email or Password"})
//     }

//     const isMatch = await user.comparePassword(password)

//     if(!isMatch){
//         return res.status(400).josn({message:"Invalid email or password"})
//     }

//     await sendTokenResponse(user,res,"User logged in successfully")

// }


// export const googleCallBack = async(req,res)=>{

//     console.log(req.user)

//     res.redirect("http://localhost:5173/")
// }


// export const getMe = async (req,res) =>{
//     const user = req.user

//     res.status(200).json({
//         message:"User fetched successfully",
//         success:true,
//         user:{
//             id:user._id,
//             email:user.email,
//             contact:user.contact,
//             fullname:user.fullname,
//             role:user.role
//         }
//     })
// }

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      message: "Failed to fetch user profile",
    });
  }
};