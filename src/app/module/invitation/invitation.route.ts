import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import checkAuth from "../../middleware/checkAuth";
import validateRequest from "../../middleware/validateRequest";
import { InvitationControllers } from "./invitation.controller";
import {
    TCreateInvitationPayload,
    TInvitationIdParams,
    TListMyInvitationsQuery,
    TListSentInvitationsQuery,
    InvitationValidations,
} from "./invitation.validation";

const router = Router();
type EmptyRequestParams = Record<string, never>;

router.post<EmptyRequestParams, unknown, TCreateInvitationPayload>(
    "/",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.createInvitationValidationSchema),
    InvitationControllers.createInvitationController,
);

router.get<EmptyRequestParams, unknown, unknown, TListMyInvitationsQuery>(
    "/my-invitations",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.listMyInvitationsQuerySchema),
    InvitationControllers.listMyInvitationsController,
);

router.get<EmptyRequestParams, unknown, unknown, TListSentInvitationsQuery>(
    "/sent",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.listSentInvitationsQuerySchema),
    InvitationControllers.listSentInvitationsController,
);

router.patch<TInvitationIdParams>(
    "/:id/accept",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.respondToInvitationValidationSchema),
    InvitationControllers.acceptInvitationController,
);

router.patch<TInvitationIdParams>(
    "/:id/decline",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.respondToInvitationValidationSchema),
    InvitationControllers.declineInvitationController,
);

router.patch<TInvitationIdParams>(
    "/:id/cancel",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(InvitationValidations.cancelInvitationValidationSchema),
    InvitationControllers.cancelInvitationController,
);

export const InvitationRoutes = router;
