import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ParticipationServices } from "./participation.service";
import {
    TApproveParticipantPayload,
    TBanParticipantPayload,
    TEventIdParams,
    TListMyParticipationsQuery,
    TParticipantIdParams,
    TRejectParticipantPayload,
} from "./participation.validation";

type EmptyRequestParams = Record<string, never>;

const getRequestUserOrThrow = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const joinEventController = catchAsync<TEventIdParams>(async (req, res) => {
    const result = await ParticipationServices.joinEvent(
        getRequestUserOrThrow(req.user),
        req.params,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Participation request processed successfully.",
        data: result,
    });
});

const listMyParticipationsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListMyParticipationsQuery
>(async (req, res) => {
    const result = await ParticipationServices.listMyParticipations(
        getRequestUserOrThrow(req.user),
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Participations fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const approveParticipantController = catchAsync<
    TParticipantIdParams,
    unknown,
    TApproveParticipantPayload
>(async (req, res) => {
    const result = await ParticipationServices.approveParticipant(
        getRequestUserOrThrow(req.user),
        req.params,
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Participant approved successfully.",
        data: result,
    });
});

const rejectParticipantController = catchAsync<
    TParticipantIdParams,
    unknown,
    TRejectParticipantPayload
>(async (req, res) => {
    const result = await ParticipationServices.rejectParticipant(
        getRequestUserOrThrow(req.user),
        req.params,
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Participant rejected successfully.",
        data: result,
    });
});

const banParticipantController = catchAsync<
    TParticipantIdParams,
    unknown,
    TBanParticipantPayload
>(async (req, res) => {
    const result = await ParticipationServices.banParticipant(
        getRequestUserOrThrow(req.user),
        req.params,
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Participant banned successfully.",
        data: result,
    });
});

export const ParticipationControllers = {
    joinEventController,
    listMyParticipationsController,
    approveParticipantController,
    rejectParticipantController,
    banParticipantController,
};
