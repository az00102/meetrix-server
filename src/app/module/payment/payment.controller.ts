import status from "http-status";
import { Request } from "express";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { PaymentServices } from "./payment.service";
import {
    TInitiatePaymentPayload,
    TListMyPaymentsQuery,
    TPaymentIdParams,
    TSslCommerzCallbackParams,
    PaymentValidations,
} from "./payment.validation";

type EmptyRequestParams = Record<string, never>;

const getRequestUserOrThrow = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const getGatewayPayloadFromRequest = (req: Request) =>
    PaymentValidations.sslCommerzCallbackPayloadSchema.parse(
        Object.keys(req.body ?? {}).length > 0 ? req.body : req.query,
    );

const initiatePaymentController = catchAsync<
    EmptyRequestParams,
    unknown,
    TInitiatePaymentPayload
>(async (req, res) => {
    const result = await PaymentServices.initiatePayment(
        getRequestUserOrThrow(req.user),
        req.body,
    );

    sendResponse(res, {
        responseStatus: status.CREATED,
        success: true,
        responseMessage: "Payment initiated successfully.",
        data: result,
    });
});

const listMyPaymentsController = catchAsync<
    EmptyRequestParams,
    unknown,
    unknown,
    TListMyPaymentsQuery
>(async (req, res) => {
    const result = await PaymentServices.listMyPayments(
        getRequestUserOrThrow(req.user),
        req.query,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Payments fetched successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const getPaymentByIdController = catchAsync<TPaymentIdParams>(async (req, res) => {
    const result = await PaymentServices.getPaymentById(
        getRequestUserOrThrow(req.user),
        req.params,
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Payment fetched successfully.",
        data: result,
    });
});

const handleGatewayCallbackController = catchAsync<TSslCommerzCallbackParams>(
    async (req, res) => {
        const result = await PaymentServices.handleGatewayCallback(
            req.params,
            getGatewayPayloadFromRequest(req),
        );

        res.redirect(status.SEE_OTHER, result.redirectUrl);
    },
);

const handleGatewayIpnController = catchAsync(async (req, res) => {
    const result = await PaymentServices.handleGatewayIpn(
        getGatewayPayloadFromRequest(req),
    );

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "Payment IPN processed successfully.",
        data: result,
    });
});

export const PaymentControllers = {
    initiatePaymentController,
    listMyPaymentsController,
    getPaymentByIdController,
    handleGatewayCallbackController,
    handleGatewayIpnController,
};
