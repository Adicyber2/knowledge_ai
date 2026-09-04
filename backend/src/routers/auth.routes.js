// import { authenticateUser } from "../middlewares/auth.middleware.js"
// const router = Router()

// router.post("/register",validateRegisterUser,register)

// router.post("/login",validateLoginUser,login)


// router.get("/me",authenticateUser,getMe)

// export default router

import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  register,
  login,
  refreshToken,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.get("/me", authMiddleware, getCurrentUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;