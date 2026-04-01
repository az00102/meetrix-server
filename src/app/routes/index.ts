import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { EventRoutes } from "../module/event/event.route";


const router = Router();

router.use("/auth", AuthRoutes)
router.use("/events", EventRoutes)

export const IndexRoutes = router;
