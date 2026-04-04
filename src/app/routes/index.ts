import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { EventRoutes } from "../module/event/event.route";
import { ParticipationRoutes } from "../module/participation/participation.route";


const router = Router();

router.use("/auth", AuthRoutes)
router.use("/events", EventRoutes)
router.use("/participations", ParticipationRoutes)

export const IndexRoutes = router;
