import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { InvitationServices } from "./invitation.service";
import {
    TCreateInvitationPayload,
    TInvitationIdParams,
    TListMyInvitationsQuery,
    TListSentInvitationsQuery,
} from "./invitation.validation";

type EmptyRequestParams = Record<string, never>;

const getRequestUserOrThrow = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const createInvitationController = catchAsync<
    EmptyRequestParams,
    unknown,
    TCreateInvitationPayload
>(async (req, res) => {
    const result = await InvitationServices.createInvitation(
        getRequestUserOrThrow(req.user),
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.CREATED,
        success: true,
        responseMessage: "Invitation created successfully.",
        data: result,
    });
});

const listMyInvitationsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListMyInvitationsQuery
>(async (req, res) => {
    const result = await InvitationServices.listMyInvitations(
        getRequestUserOrThrow(req.user),
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Invitations fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const listSentInvitationsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListSentInvitationsQuery
>(async (req, res) => {
    const result = await InvitationServices.listSentInvitations(
        getRequestUserOrThrow(req.user),
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Sent invitations fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const acceptInvitationController = catchAsync<TInvitationIdParams>(
    async (req, res) => {
        const result = await InvitationServices.acceptInvitation(
            getRequestUserOrThrow(req.user),
            req.params,
        );

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Invitation accepted successfully.",
            data: result,
        });
    },
);

const declineInvitationController = catchAsync<TInvitationIdParams>(
    async (req, res) => {
        const result = await InvitationServices.declineInvitation(
            getRequestUserOrThrow(req.user),
            req.params,
        );

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Invitation declined successfully.",
            data: result,
        });
    },
);

const cancelInvitationController = catchAsync<TInvitationIdParams>(
    async (req, res) => {
        const result = await InvitationServices.cancelInvitation(
            getRequestUserOrThrow(req.user),
            req.params,
        );

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Invitation cancelled successfully.",
            data: result,
        });
    },
);

export const InvitationControllers = {
    createInvitationController,
    listMyInvitationsController,
    listSentInvitationsController,
    acceptInvitationController,
    declineInvitationController,
    cancelInvitationController,
};
