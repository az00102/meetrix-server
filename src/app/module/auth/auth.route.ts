import { Router } from "express";
import { AuthControllers } from "./auth.controller";
import checkAuth from "../../middleware/checkAuth";
import validateRequest from "../../middleware/validateRequest";
import { UserRole } from "../../../generated/prisma/enums";
import { AuthValidations } from "./auth.validation";

const router = Router();

router.post(
    "/register",
    validateRequest(AuthValidations.registerUserValidationSchema),
    AuthControllers.registerUserController,
);
router.post(
    "/login",
    validateRequest(AuthValidations.loginUserValidationSchema),
    AuthControllers.loginUserController,
);
router.post('/refresh-token', AuthControllers.getNewTokenController);
router.post("/logout", checkAuth(UserRole.ADMIN, UserRole.USER), AuthControllers.logoutUserController)
router.get('/me', checkAuth(), AuthControllers.getMeController);
router.patch(
    '/me',
    checkAuth(),
    validateRequest(AuthValidations.updateMeValidationSchema),
    AuthControllers.updateMeController,
);

export const AuthRoutes = router;
