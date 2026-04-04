import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import checkAuth from "../../middleware/checkAuth";
import optionalAuth from "../../middleware/optionalAuth";
import validateRequest from "../../middleware/validateRequest";
import { EventControllers } from "./event.controller";
import {
    EventValidations,
    TCreateEventPayload,
    TEventIdParams,
    TEventSlugParams,
    TGetUpcomingEventsQuery,
    TListEventParticipantsQuery,
    TListEventsQuery,
    TListMyEventsQuery,
    TUpdateEventPayload,
} from "./event.validation";

const router = Router();
type EmptyRequestParams = Record<string, never>;

router.get<EmptyRequestParams, unknown, unknown, TListEventsQuery>(
    "/",
    validateRequest(EventValidations.listEventsQuerySchema),
    EventControllers.listEventsController,
);
router.get("/featured", EventControllers.getFeaturedEventController);
router.get<EmptyRequestParams, unknown, unknown, TGetUpcomingEventsQuery>(
    "/upcoming",
    validateRequest(EventValidations.getUpcomingEventsQuerySchema),
    EventControllers.getUpcomingEventsController,
);

router.post<EmptyRequestParams, unknown, TCreateEventPayload>(
    "/",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidations.createEventValidationSchema),
    EventControllers.createEventController,
);
router.get<EmptyRequestParams, unknown, unknown, TListMyEventsQuery>(
    "/my-events",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidations.listMyEventsQuerySchema),
    EventControllers.listMyEventsController,
);
router.get<TEventIdParams, unknown, unknown, TListEventParticipantsQuery>(
    "/:id/participants",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidations.listEventParticipantsValidationSchema),
    EventControllers.getEventParticipantsController,
);
router.patch<TEventIdParams, unknown, TUpdateEventPayload>(
    "/:id",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidations.updateEventValidationSchema),
    EventControllers.updateEventController,
);
router.delete<TEventIdParams>(
    "/:id",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidations.eventIdParamsSchema),
    EventControllers.deleteEventController,
);

router.get<TEventSlugParams>(
    "/:slug/access-state",
    validateRequest(EventValidations.eventSlugParamsSchema),
    optionalAuth,
    EventControllers.getEventAccessStateController,
);

router.get<TEventSlugParams>(
    "/:slug",
    validateRequest(EventValidations.eventSlugParamsSchema),
    EventControllers.getEventBySlugController,
);

export const EventRoutes = router;
