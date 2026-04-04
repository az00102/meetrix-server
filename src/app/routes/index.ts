import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { EventRoutes } from "../module/event/event.route";
import { InvitationRoutes } from "../module/invitation/invitation.route";
import { PaymentRoutes } from "../module/payment/payment.route";
import { ParticipationRoutes } from "../module/participation/participation.route";


const router = Router();

router.use("/auth", AuthRoutes)
router.use("/events", EventRoutes)
router.use("/participations", ParticipationRoutes)
router.use("/invitations", InvitationRoutes)
router.use("/payments", PaymentRoutes)

export const IndexRoutes = router;
