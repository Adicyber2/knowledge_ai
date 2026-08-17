
// import { authenticateUser } from "../middlewares/auth.middleware.js"
// const router = Router()

// router.post("/register",validateRegisterUser,register)

// router.post("/login",validateLoginUser,login)


// router.get("/me",authenticateUser,getMe)

// export default router

import express from "express";
import {
  register,
  login,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

export default router;