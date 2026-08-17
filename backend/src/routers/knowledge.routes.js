// import express from "express";

// import authMiddleware 
// from "../middlewares/auth.middleware.js";

// import {
//  createKnowledge,
//  getKnowledge,
//  deleteKnowledge
// }
// from "../controllers/knowledge.controller.js";


// const router = express.Router();


// router.post(
// "/",
// authMiddleware,
// createKnowledge
// );


// router.get(
// "/",
// authMiddleware,
// getKnowledge
// );


// router.delete(
// "/:id",
// authMiddleware,
// deleteKnowledge
// );



// export default router;



import express from "express";

import {
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from "../controllers/knowledge.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  getKnowledge
);
router.post(
  "/",
  authMiddleware,
  createKnowledge
);
router.put(
  "/:id",
  authMiddleware,
  updateKnowledge
);

router.delete(
  "/:id",
  authMiddleware,
  deleteKnowledge
);


export default router;