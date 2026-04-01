import { RequestHandler } from "express";
import status from "http-status";
import sendResponse from "../../shared/sendResponse";
import catchAsync from "../../shared/catchAsync";
import { EventServices } from "./event.service";
import {
    TEventSlugParams,
    TGetUpcomingEventsQuery,
    TListEventsQuery,
} from "./event.validation";

type EmptyRequestParams = Record<string, never>;

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

const getFeaturedEventController: RequestHandler = catchAsync(
    async (_req, res) => {
        const result = await EventServices.getFeaturedEvent();

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Featured event fetched successfully.",
            data: result,
        });
    },
);

const getUpcomingEventsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TGetUpcomingEventsQuery
>(
    async (req, res) => {
        const result = await EventServices.getUpcomingEvents(req.query);

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Upcoming events fetched successfully.",
            data: result,
        });
    },
);

const getEventBySlugController = catchAsync<TEventSlugParams>(
    async (req, res) => {
        const result = await EventServices.getEventBySlug(req.params);

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Event fetched successfully.",
            data: result,
        });
    },
);

export const EventControllers = {
    listEventsController,
    getFeaturedEventController,
    getUpcomingEventsController,
    getEventBySlugController,
};
