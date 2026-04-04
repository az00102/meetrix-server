import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import checkAuth from "../../middleware/checkAuth";
import validateRequest from "../../middleware/validateRequest";
import { PaymentControllers } from "./payment.controller";
import {
    PaymentValidations,
    TInitiatePaymentPayload,
    TListMyPaymentsQuery,
    TPaymentIdParams,
    TSslCommerzCallbackParams,
} from "./payment.validation";

const router = Router();
type EmptyRequestParams = Record<string, never>;

router.post<EmptyRequestParams, unknown, TInitiatePaymentPayload>(
    "/initiate",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(PaymentValidations.initiatePaymentValidationSchema),
    PaymentControllers.initiatePaymentController,
);

router.get<EmptyRequestParams, unknown, unknown, TListMyPaymentsQuery>(
    "/my-payments",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(PaymentValidations.listMyPaymentsQuerySchema),
    PaymentControllers.listMyPaymentsController,
);

router.post<TSslCommerzCallbackParams>(
    "/callback/:outcome",
    validateRequest(PaymentValidations.sslCommerzCallbackParamsSchema),
    PaymentControllers.handleGatewayCallbackController,
);

router.get<TSslCommerzCallbackParams>(
    "/callback/:outcome",
    validateRequest(PaymentValidations.sslCommerzCallbackParamsSchema),
    PaymentControllers.handleGatewayCallbackController,
);

router.post("/ipn", PaymentControllers.handleGatewayIpnController);

router.get<TPaymentIdParams>(
    "/:id",
    checkAuth(UserRole.ADMIN, UserRole.USER),
    validateRequest(PaymentValidations.paymentIdParamsSchema),
    PaymentControllers.getPaymentByIdController,
);

export const PaymentRoutes = router;
