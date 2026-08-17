// import jwt from "jsonwebtoken"
// import {config} from "../config/config.js"
// import userModel from "../models/user.model.js"



// export const authenticateUser = async (req,res,next) =>{

//     const token  = req.cookies.token

//     if(!token){
//         return res.status(401).json({messgae:"Unauthorized"})
//     }

//     try{

//         const decoded = jwt.verify(token,config.JWT_SECRET)

//         const user = await userModel.findById(decoded.id)

//         if(!user){
//             return res.status(401).json({message:"Unauthorized"})
//         }
//         req.user = user
//     next()
//     }catch(err){
//         console.log(err)
//         return res.status.json({message:"Unathorized"})
//     }

// }


// export const authenticateSeller =async (req,res,next)=>{

//     const token = req.cookies.token

//     if(!token){
//         return res.status(401).json({message:"Unothorized"})

//     }

//     try{

//         const decoded = jwt.verify(token,config.JWT_SECRET)

//         const user = await userModel.findById(decoded.id)

//         if(!user){
//             return res.status(401).json({message:"Unauthorized"})
//         }

//         if(user.role!=="seller"){
//             return res.status(403).josn({message:"Forbidden"})
//         }

//         req.user =user
//         next()


//     }catch(err){
//         console.log(err)
//         return res.status(401).josn({message:"Unauthorized"})
//     }
// }


import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default authMiddleware;