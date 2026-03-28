import { Router } from "express";
import { AuthControllers } from "./auth.controller";

const router = Router();

router.post("/register", AuthControllers.registerUserController);
router.post("/login", AuthControllers.loginUserController);
router.post('/refresh-token', AuthControllers.getNewTokenController);
router.post("/logout", AuthControllers.logoutUserController)

export const AuthRoutes = router;