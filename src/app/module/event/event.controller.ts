import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { EventServices } from "./event.service";
import {
    TCreateEventPayload,
    TEventIdParams,
    TEventSlugParams,
    TGetUpcomingEventsQuery,
    TListEventParticipantsQuery,
    TListEventsQuery,
    TListMyEventsQuery,
    TUpdateEventPayload,
} from "./event.validation";

type EmptyRequestParams = Record<string, never>;

const getRequestUserOrThrow = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const listEventsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListEventsQuery
>(async (req, res) => {
    const result = await EventServices.listEvents(req.query);

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Events fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const getFeaturedEventController = catchAsync(async (_req, res) => {
    const result = await EventServices.getFeaturedEvent();

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Featured event fetched successfully.",
        data: result,
    });
});

const getUpcomingEventsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TGetUpcomingEventsQuery
>(async (req, res) => {
    const result = await EventServices.getUpcomingEvents(req.query);

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Upcoming events fetched successfully.",
        data: result,
    });
});

const getEventBySlugController = catchAsync<TEventSlugParams>(async (req, res) => {
    const result = await EventServices.getEventBySlug(req.params);

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Event fetched successfully.",
        data: result,
    });
});

const getEventAccessStateController = catchAsync<TEventSlugParams>(
    async (req, res) => {
        const result = await EventServices.getEventAccessState(
            req.params,
            req.user,
        );

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Event access state fetched successfully.",
            data: result,
        });
    },
);

const createEventController = catchAsync<
    EmptyRequestParams,
    unknown,
    TCreateEventPayload
>(async (req, res) => {
    const result = await EventServices.createEvent(
        getRequestUserOrThrow(req.user),
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.CREATED,
        success: true,
        responseMessage: "Event created successfully.",
        data: result,
    });
});

const listMyEventsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListMyEventsQuery
>(async (req, res) => {
    const result = await EventServices.listMyEvents(
        getRequestUserOrThrow(req.user),
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Your events fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const updateEventController = catchAsync<
    TEventIdParams,
    unknown,
    TUpdateEventPayload
>(async (req, res) => {
    const result = await EventServices.updateEvent(
        getRequestUserOrThrow(req.user),
        req.params,
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Event updated successfully.",
        data: result,
    });
});

const deleteEventController = catchAsync<TEventIdParams>(async (req, res) => {
    const result = await EventServices.deleteEvent(
        getRequestUserOrThrow(req.user),
        req.params,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Event deleted successfully.",
        data: result,
    });
});

const getEventParticipantsController = catchAsync<
    TEventIdParams,
    unknown,
    unknown,
    TListEventParticipantsQuery
>(async (req, res) => {
    const result = await EventServices.getEventParticipants(
        getRequestUserOrThrow(req.user),
        req.params,
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Event participants fetched successfully.",
        meta: result.meta,
        data: {
            event: result.event,
            participants: result.data,
        },
    });
});

export const EventControllers = {
    listEventsController,
    getFeaturedEventController,
    getUpcomingEventsController,
    getEventBySlugController,
    getEventAccessStateController,
    createEventController,
    listMyEventsController,
    updateEventController,
    deleteEventController,
    getEventParticipantsController,
};
