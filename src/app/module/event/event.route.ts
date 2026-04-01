import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { EventControllers } from "./event.controller";
import {
    EventValidations,
    TEventSlugParams,
    TGetUpcomingEventsQuery,
    TListEventsQuery,
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
router.get<TEventSlugParams>(
    "/:slug",
    validateRequest(EventValidations.eventSlugParamsSchema),
    EventControllers.getEventBySlugController,
);

export const EventRoutes = router;
