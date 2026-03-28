import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";


const router = Router();

router.use("/auth", AuthRoutes)

export const IndexRoutes = router;