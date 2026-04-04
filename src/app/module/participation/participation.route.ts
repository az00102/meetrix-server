import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import checkAuth from "../../middleware/checkAuth";
import validateRequest from "../../middleware/validateRequest";
import { ParticipationControllers } from "./participation.controller";
import {
    TApproveParticipantPayload,
    TBanParticipantPayload,
    TEventIdParams,
    TListMyParticipationsQuery,
    TParticipantIdParams,
    TRejectParticipantPayload,
    ParticipationValidations,
} from "./participation.validation";

const router = Router();
type EmptyRequestParams = Record<string, never>;

router.get<EmptyRequestParams, unknown, unknown, TListMyParticipationsQuery>(
    "/my-participations",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ParticipationValidations.listMyParticipationsQuerySchema),
    ParticipationControllers.listMyParticipationsController,
);

router.post<TEventIdParams>(
    "/events/:eventId/join",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ParticipationValidations.joinEventValidationSchema),
    ParticipationControllers.joinEventController,
);

router.patch<TParticipantIdParams, unknown, TApproveParticipantPayload>(
    "/:id/approve",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ParticipationValidations.approveParticipantValidationSchema),
    ParticipationControllers.approveParticipantController,
);

router.patch<TParticipantIdParams, unknown, TRejectParticipantPayload>(
    "/:id/reject",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ParticipationValidations.rejectParticipantValidationSchema),
    ParticipationControllers.rejectParticipantController,
);

router.patch<TParticipantIdParams, unknown, TBanParticipantPayload>(
    "/:id/ban",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ParticipationValidations.banParticipantValidationSchema),
    ParticipationControllers.banParticipantController,
);

export const ParticipationRoutes = router;
