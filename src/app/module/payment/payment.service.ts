import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    EventPricingType,
    EventStatus,
    EventVisibility,
    InvitationStatus,
    NotificationType,
    ParticipantStatus,
    ParticipationJoinType,
    PaymentProvider,
    PaymentPurpose,
    PaymentStatus,
    UserRole,
} from "../../../generated/prisma/enums";
import { envVars } from "../../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import { IQueryResult } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import {
    TSslCommerzValidationRecord,
    sslCommerzProvider,
} from "./providers/sslcommerz.provider";
import {
    TInitiatePaymentPayload,
    TListMyPaymentsQuery,
    TPaymentIdParams,
    TSslCommerzCallbackParams,
    TSslCommerzCallbackPayload,
} from "./payment.validation";

const PAYMENT_SESSION_EXPIRES_IN_MS = 30 * 60 * 1000;
const PAYMENT_INITIATION_TRANSACTION_TIMEOUT_MS = 15 * 1000;
const PAYMENT_INITIATION_TRANSACTION_MAX_WAIT_MS = 10 * 1000;
const SSLCOMMERZ_MIN_AMOUNT = 10;
const SSLCOMMERZ_MAX_AMOUNT = 500000;
const FRONTEND_PAYMENT_RETURN_PATH = "/dashboard/payments/return";
const SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION = !envVars.SSLCOMMERZ_IS_SANDBOX;

const paymentSelect = {
    id: true,
    userId: true,
    eventId: true,
    participantId: true,
    invitationId: true,
    provider: true,
    purpose: true,
    amount: true,
    currency: true,
    status: true,
    providerTransactionId: true,
    gatewayStatus: true,
    gatewayPayload: true,
    failureReason: true,
    paidAt: true,
    refundedAt: true,
    expiresAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
        },
    },
    event: {
        select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            visibility: true,
            pricingType: true,
            registrationFee: true,
            currency: true,
            status: true,
            capacity: true,
            isDeleted: true,
            ownerId: true,
            owner: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    },
    participant: {
        select: {
            id: true,
            userId: true,
            joinType: true,
            status: true,
            paymentStatus: true,
            approvalNote: true,
            rejectionReason: true,
            approvedById: true,
            respondedAt: true,
            approvedAt: true,
            joinedAt: true,
            bannedAt: true,
        },
    },
    invitation: {
        select: {
            id: true,
            eventId: true,
            inviteeId: true,
            invitedById: true,
            status: true,
            paymentStatus: true,
            expiresAt: true,
            respondedAt: true,
            acceptedAt: true,
            declinedAt: true,
        },
    },
} as const;

type PaymentRecord = Prisma.PaymentGetPayload<{
    select: typeof paymentSelect;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toMoneyNumber = (value: Prisma.Decimal | number) =>
    typeof value === "number" ? value : Number(value.toString());

const buildPaginationMeta = (
    page: number,
    limit: number,
    total: number,
): IQueryResult<unknown>["meta"] => ({
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

const getEventAccessPolicy = (
    visibility: EventVisibility,
    pricingType: EventPricingType,
) => ({
    requiresPayment: pricingType === EventPricingType.PAID,
    requiresApproval:
        visibility === EventVisibility.PRIVATE ||
        pricingType === EventPricingType.PAID,
});

const getGatewayPayloadObject = (
    gatewayPayload: Prisma.JsonValue | null,
): Record<string, unknown> => {
    if (!isRecord(gatewayPayload)) {
        return {};
    }

    return { ...gatewayPayload };
};

const getPaymentRedirectUrlFromGatewayPayload = (
    gatewayPayload: Prisma.JsonValue | null,
): string | null => {
    const gatewayPayloadObject = getGatewayPayloadObject(gatewayPayload);
    const initialization =
        isRecord(gatewayPayloadObject.initialization)
            ? gatewayPayloadObject.initialization
            : null;

    const gatewayPageUrl =
        initialization && typeof initialization.GatewayPageURL === "string"
            ? initialization.GatewayPageURL.trim()
            : "";

    if (gatewayPageUrl) {
        return gatewayPageUrl;
    }

    const redirectGatewayUrl =
        initialization && typeof initialization.redirectGatewayURL === "string"
            ? initialization.redirectGatewayURL.trim()
            : "";

    return redirectGatewayUrl || null;
};

const getPersistedPaymentRedirectUrl = (gatewayPayload: Prisma.JsonValue | null) =>
    SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION
        ? getPaymentRedirectUrlFromGatewayPayload(gatewayPayload)
        : null;

const getManualReviewReason = (
    gatewayPayload: Prisma.JsonValue | null,
): string | null => {
    const gatewayPayloadObject = getGatewayPayloadObject(gatewayPayload);
    const manualReview =
        isRecord(gatewayPayloadObject.manualReview)
            ? gatewayPayloadObject.manualReview
            : null;

    return manualReview && typeof manualReview.reason === "string"
        ? manualReview.reason
        : null;
};

const mergeGatewayPayload = (
    gatewayPayload: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
): Prisma.InputJsonValue => ({
    ...getGatewayPayloadObject(gatewayPayload),
    ...patch,
}) as Prisma.InputJsonValue;

const formatPayment = (payment: PaymentRecord) => ({
    id: payment.id,
    transactionId: payment.id,
    provider: payment.provider,
    purpose: payment.purpose,
    amount: toMoneyNumber(payment.amount),
    currency: payment.currency,
    status: payment.status,
    providerTransactionId: payment.providerTransactionId,
    gatewayStatus: payment.gatewayStatus,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt,
    refundedAt: payment.refundedAt,
    expiresAt: payment.expiresAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    redirectUrl:
        payment.status === PaymentStatus.PENDING
            ? getPersistedPaymentRedirectUrl(payment.gatewayPayload)
            : null,
    manualReviewReason: getManualReviewReason(payment.gatewayPayload),
    requiresManualReview: Boolean(getManualReviewReason(payment.gatewayPayload)),
    user: {
        id: payment.user.id,
        name: payment.user.name,
        email: payment.user.email,
        image: payment.user.image,
    },
    event: {
        id: payment.event.id,
        title: payment.event.title,
        slug: payment.event.slug,
        startsAt: payment.event.startsAt,
        visibility: payment.event.visibility,
        pricingType: payment.event.pricingType,
        registrationFee: toMoneyNumber(payment.event.registrationFee),
        currency: payment.event.currency,
        owner: payment.event.owner,
        ...getEventAccessPolicy(
            payment.event.visibility,
            payment.event.pricingType,
        ),
    },
    participant: payment.participant
        ? {
              id: payment.participant.id,
              joinType: payment.participant.joinType,
              status: payment.participant.status,
              paymentStatus: payment.participant.paymentStatus,
          }
        : null,
    invitation: payment.invitation
        ? {
              id: payment.invitation.id,
              status: payment.invitation.status,
              paymentStatus: payment.invitation.paymentStatus,
              expiresAt: payment.invitation.expiresAt,
          }
        : null,
});

const ensureRequestUser = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const ensureSupportedSslCommerzAmount = (amount: number) => {
    if (amount < SSLCOMMERZ_MIN_AMOUNT || amount > SSLCOMMERZ_MAX_AMOUNT) {
        throw new AppError(
            status.BAD_REQUEST,
            `SSLCOMMERZ supports amounts between ${SSLCOMMERZ_MIN_AMOUNT.toFixed(
                2,
            )} and ${SSLCOMMERZ_MAX_AMOUNT.toFixed(2)} BDT for this integration.`,
        );
    }
};

const isTerminalPaymentStatus = (paymentStatus: PaymentStatus) =>
    paymentStatus === PaymentStatus.PAID ||
    paymentStatus === PaymentStatus.FAILED ||
    paymentStatus === PaymentStatus.CANCELLED ||
    paymentStatus === PaymentStatus.REFUNDED;

const buildFrontendPaymentReturnUrl = (
    paymentId: string | null,
    paymentStatus: PaymentStatus | "INVALID" | "PENDING",
) => {
    const redirectUrl = new URL(
        FRONTEND_PAYMENT_RETURN_PATH,
        envVars.FRONTEND_URL,
    );

    redirectUrl.searchParams.set("status", paymentStatus);

    if (paymentId) {
        redirectUrl.searchParams.set("paymentId", paymentId);
    }

    return redirectUrl.toString();
};

const createPaymentNotification = async (
    tx: Prisma.TransactionClient,
    payment: PaymentRecord,
    notificationType: NotificationType,
    title: string,
    message: string,
) => {
    await tx.notification.create({
        data: {
            userId: payment.userId,
            type: notificationType,
            title,
            message,
            eventId: payment.eventId,
            paymentId: payment.id,
            participantId: payment.participantId ?? null,
            invitationId: payment.invitationId ?? null,
            metadata: {
                paymentId: payment.id,
                purpose: payment.purpose,
                status:
                    notificationType === NotificationType.PAYMENT_SUCCESS
                        ? PaymentStatus.PAID
                        : payment.status,
            },
        },
    });
};

const buildPaymentVerificationGatewayPayload = (
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
    manualReviewReason: string | null,
) =>
    mergeGatewayPayload(payment.gatewayPayload, {
        verification,
        lastCallbackPayload: callbackPayload,
        manualReview: manualReviewReason
            ? {
                  reason: manualReviewReason,
                  detectedAt: new Date().toISOString(),
              }
            : null,
    });

const getCallbackFailureReason = (
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
) => {
    const providerError =
        typeof verification.error === "string" && verification.error.trim()
            ? verification.error.trim()
            : null;

    if (providerError) {
        return providerError;
    }

    const callbackStatus =
        typeof callbackPayload.status === "string" && callbackPayload.status.trim()
            ? callbackPayload.status.trim()
            : null;

    if (callbackStatus) {
        return `Payment ${callbackStatus.toLowerCase()} by SSLCOMMERZ.`;
    }

    return "Payment could not be completed.";
};

const verifySslCommerzPayment = async (
    paymentId: string,
    validationId: string | null,
) => {
    if (validationId) {
        try {
            return await sslCommerzProvider.queryTransactionByValidationId(
                validationId,
            );
        } catch {
            return sslCommerzProvider.queryTransactionByTranId(paymentId);
        }
    }

    return sslCommerzProvider.queryTransactionByTranId(paymentId);
};

const logSslCommerzVerification = (
    paymentId: string,
    verification: TSslCommerzValidationRecord,
) => {
    console.info("SSLCommerz verification result", {
        paymentId,
        verificationStatus: verification.status,
        val_id: verification.val_id,
        tran_id: verification.tran_id,
        bank_tran_id: verification.bank_tran_id,
        amount: verification.amount,
        risk_level: verification.risk_level,
        risk_title: verification.risk_title,
    });
};

const ensureEventHasCapacity = async (
    tx: Prisma.TransactionClient,
    eventId: string,
    capacity: number | null,
) => {
    if (!capacity) {
        return;
    }

    const approvedParticipantsCount = await tx.eventParticipant.count({
        where: {
            eventId,
            status: ParticipantStatus.APPROVED,
        },
    });

    if (approvedParticipantsCount >= capacity) {
        throw new AppError(
            status.BAD_REQUEST,
            "Event capacity has already been reached.",
        );
    }
};

const cancelPendingPaymentsForSource = async (
    tx: Prisma.TransactionClient,
    where: Prisma.PaymentWhereInput,
) => {
    await tx.payment.updateMany({
        where: {
            ...where,
            status: PaymentStatus.PENDING,
        },
        data: {
            status: PaymentStatus.CANCELLED,
            gatewayStatus: "REPLACED",
            failureReason: "Payment attempt replaced by a new checkout session.",
        },
    });
};

const getReusablePendingPayment = async (
    tx: Prisma.TransactionClient,
    where: Prisma.PaymentWhereInput,
) =>
    tx.payment.findFirst({
        where: {
            ...where,
            status: PaymentStatus.PENDING,
            expiresAt: {
                gt: new Date(),
            },
        },
        select: paymentSelect,
        orderBy: {
            createdAt: "desc",
        },
    });

const initializeHostedSessionForPayment = async (
    payment: PaymentRecord,
    customer: {
        name: string;
        email: string;
        phone: string;
    },
) => {
    try {
        const initialization = await sslCommerzProvider.createHostedSession({
            tranId: payment.id,
            amount: toMoneyNumber(payment.amount),
            currency: payment.currency,
            successUrl: `${envVars.BACKEND_URL}/api/v1/payments/callback/success`,
            failUrl: `${envVars.BACKEND_URL}/api/v1/payments/callback/fail`,
            cancelUrl: `${envVars.BACKEND_URL}/api/v1/payments/callback/cancel`,
            ipnUrl: `${envVars.BACKEND_URL}/api/v1/payments/ipn`,
            customer,
            product: {
                name: payment.event.title,
                category: "event-registration",
                profile: "non-physical-goods",
            },
            metadata: {
                valueA: payment.id,
                valueB: payment.purpose,
                valueC: payment.userId,
                valueD: payment.participantId ?? payment.invitationId ?? payment.eventId,
            },
            emiOption: 0,
            multiCardName: "visacard,mastercard,amexcard",
        });

        const updatedPayment = await prisma.payment.update({
            where: {
                id: payment.id,
            },
            data: {
                gatewayStatus:
                    typeof initialization.status === "string"
                        ? initialization.status.toUpperCase()
                        : "SUCCESS",
                gatewayPayload: mergeGatewayPayload(payment.gatewayPayload, {
                    initialization,
                }),
            },
            select: paymentSelect,
        });

        return {
            paymentId: updatedPayment.id,
            status: updatedPayment.status,
            redirectUrl:
                sslCommerzProvider.getGatewayRedirectUrl(initialization) ?? "",
            payment: formatPayment(updatedPayment),
        };
    } catch (error) {
        const failureMessage =
            error instanceof Error
                ? error.message
                : "Unable to initiate the payment session.";

        await prisma.$transaction(async (tx) => {
            const existingPayment = await tx.payment.findUnique({
                where: {
                    id: payment.id,
                },
                select: paymentSelect,
            });

            if (!existingPayment || existingPayment.status !== PaymentStatus.PENDING) {
                return;
            }

            await tx.payment.update({
                where: {
                    id: existingPayment.id,
                },
                data: {
                    status: PaymentStatus.FAILED,
                    gatewayStatus: "INITIATION_FAILED",
                    failureReason: failureMessage,
                    gatewayPayload: mergeGatewayPayload(
                        existingPayment.gatewayPayload,
                        {
                            initiationError: {
                                message: failureMessage,
                                failedAt: new Date().toISOString(),
                            },
                        },
                    ),
                },
            });

            if (
                existingPayment.purpose === PaymentPurpose.EVENT_REGISTRATION &&
                existingPayment.participantId
            ) {
                await tx.eventParticipant.update({
                    where: {
                        id: existingPayment.participantId,
                    },
                    data: {
                        status: ParticipantStatus.CANCELLED,
                        paymentStatus: PaymentStatus.FAILED,
                    },
                });
            }

            if (
                existingPayment.purpose === PaymentPurpose.INVITATION_ACCEPTANCE &&
                existingPayment.invitationId
            ) {
                await tx.invitation.update({
                    where: {
                        id: existingPayment.invitationId,
                    },
                    data: {
                        paymentStatus: PaymentStatus.FAILED,
                    },
                });
            }
        });

        throw error;
    }
};

const prepareEventRegistrationPayment = async (
    authUser: IAuthUser,
    payload: TInitiatePaymentPayload,
) => {
    const eventId = payload.eventId as string;

    const result = await prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({
            where: {
                id: eventId,
            },
            select: {
                id: true,
                title: true,
                slug: true,
                ownerId: true,
                isDeleted: true,
                status: true,
                visibility: true,
                pricingType: true,
                registrationFee: true,
                currency: true,
                capacity: true,
            },
        });

        const existingParticipant = await tx.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId: authUser.userId,
                },
            },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
            },
        });

        const pendingInvitation = await tx.invitation.findFirst({
            where: {
                eventId,
                inviteeId: authUser.userId,
                status: InvitationStatus.PENDING,
            },
            select: {
                id: true,
            },
        });

        const customer = await tx.user.findUnique({
            where: {
                id: authUser.userId,
            },
            select: {
                name: true,
                email: true,
                phone: true,
            },
        });

        if (!event || event.isDeleted) {
            throw new AppError(status.NOT_FOUND, "Event not found.");
        }

        if (event.status !== EventStatus.PUBLISHED) {
            throw new AppError(
                status.BAD_REQUEST,
                "Only published events can accept paid registrations.",
            );
        }

        if (event.ownerId === authUser.userId) {
            throw new AppError(
                status.BAD_REQUEST,
                "You cannot pay to join your own event.",
            );
        }

        if (event.pricingType !== EventPricingType.PAID) {
            throw new AppError(
                status.BAD_REQUEST,
                "This event does not require payment.",
            );
        }

        if (!customer) {
            throw new AppError(status.NOT_FOUND, "User account not found.");
        }

        ensureSupportedSslCommerzAmount(toMoneyNumber(event.registrationFee));

        if (pendingInvitation) {
            throw new AppError(
                status.CONFLICT,
                "You already have a pending invitation for this event. Please use the invitation payment flow instead.",
            );
        }

        if (existingParticipant?.status === ParticipantStatus.BANNED) {
            throw new AppError(
                status.FORBIDDEN,
                "You have been banned from this event.",
            );
        }

        if (existingParticipant?.status === ParticipantStatus.APPROVED) {
            throw new AppError(
                status.CONFLICT,
                "You are already participating in this event.",
            );
        }

        if (
            existingParticipant?.status === ParticipantStatus.PENDING &&
            existingParticipant.paymentStatus === PaymentStatus.PAID
        ) {
            throw new AppError(
                status.CONFLICT,
                "Your payment is already completed and waiting for organizer approval.",
            );
        }

        if (existingParticipant?.status === ParticipantStatus.REJECTED) {
            throw new AppError(
                status.CONFLICT,
                "Your previous participation request was rejected for this event.",
            );
        }

        const reusablePayment =
            existingParticipant?.id
                ? await getReusablePendingPayment(tx, {
                      participantId: existingParticipant.id,
                  })
                : null;

        if (
            SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION &&
            reusablePayment &&
            getPaymentRedirectUrlFromGatewayPayload(reusablePayment.gatewayPayload)
        ) {
            return {
                payment: reusablePayment,
                customer: {
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone?.trim() || "01700000000",
                },
                reused: true,
            };
        }

        if (existingParticipant?.id) {
            await cancelPendingPaymentsForSource(tx, {
                participantId: existingParticipant.id,
            });
        }

        const participant = existingParticipant
            ? await tx.eventParticipant.update({
                  where: {
                      id: existingParticipant.id,
                  },
                  data: {
                      joinType:
                          event.visibility === EventVisibility.PUBLIC
                              ? ParticipationJoinType.DIRECT
                              : ParticipationJoinType.REQUEST,
                      status: ParticipantStatus.PENDING,
                      paymentStatus: PaymentStatus.PENDING,
                      approvalNote: null,
                      rejectionReason: null,
                      approvedById: null,
                      respondedAt: null,
                      approvedAt: null,
                      joinedAt: null,
                      bannedAt: null,
                  },
                  select: {
                      id: true,
                  },
              })
            : await tx.eventParticipant.create({
                  data: {
                      eventId: event.id,
                      userId: authUser.userId,
                      joinType:
                          event.visibility === EventVisibility.PUBLIC
                              ? ParticipationJoinType.DIRECT
                              : ParticipationJoinType.REQUEST,
                      status: ParticipantStatus.PENDING,
                      paymentStatus: PaymentStatus.PENDING,
                  },
                  select: {
                      id: true,
                  },
              });

        const payment = await tx.payment.create({
            data: {
                userId: authUser.userId,
                eventId: event.id,
                participantId: participant.id,
                provider: PaymentProvider.SSLCOMMERZ,
                purpose: PaymentPurpose.EVENT_REGISTRATION,
                amount: event.registrationFee,
                currency: event.currency,
                status: PaymentStatus.PENDING,
                expiresAt: new Date(Date.now() + PAYMENT_SESSION_EXPIRES_IN_MS),
                gatewayPayload: {
                    initiation: {
                        createdAt: new Date().toISOString(),
                    },
                },
            },
            select: paymentSelect,
        });

        return {
            payment,
            customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone?.trim() || "01700000000",
            },
            reused: false,
        };
    }, {
        timeout: PAYMENT_INITIATION_TRANSACTION_TIMEOUT_MS,
        maxWait: PAYMENT_INITIATION_TRANSACTION_MAX_WAIT_MS,
    });

    if (result.reused) {
        return {
            paymentId: result.payment.id,
            status: result.payment.status,
            redirectUrl:
                getPaymentRedirectUrlFromGatewayPayload(result.payment.gatewayPayload) ??
                "",
            payment: formatPayment(result.payment),
        };
    }

    return initializeHostedSessionForPayment(result.payment, result.customer);
};

const prepareInvitationAcceptancePayment = async (
    authUser: IAuthUser,
    payload: TInitiatePaymentPayload,
) => {
    const invitationId = payload.invitationId as string;

    const result = await prisma.$transaction(async (tx) => {
        const invitation = await tx.invitation.findUnique({
            where: {
                id: invitationId,
            },
            select: {
                id: true,
                eventId: true,
                inviteeId: true,
                invitedById: true,
                status: true,
                paymentStatus: true,
                expiresAt: true,
                event: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        isDeleted: true,
                        status: true,
                        pricingType: true,
                        registrationFee: true,
                        currency: true,
                        capacity: true,
                    },
                },
            },
        });

        const customer = await tx.user.findUnique({
            where: {
                id: authUser.userId,
            },
            select: {
                name: true,
                email: true,
                phone: true,
            },
        });

        if (!invitation) {
            throw new AppError(status.NOT_FOUND, "Invitation not found.");
        }

        if (invitation.inviteeId !== authUser.userId) {
            throw new AppError(
                status.FORBIDDEN,
                "You do not have permission to pay for this invitation.",
            );
        }

        if (!customer) {
            throw new AppError(status.NOT_FOUND, "User account not found.");
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending invitations can initiate payment.",
            );
        }

        const now = new Date();

        if (invitation.expiresAt && invitation.expiresAt <= now) {
            await tx.invitation.update({
                where: {
                    id: invitation.id,
                },
                data: {
                    status: InvitationStatus.EXPIRED,
                    respondedAt: now,
                },
            });

            throw new AppError(status.BAD_REQUEST, "This invitation has expired.");
        }

        if (invitation.event.isDeleted) {
            throw new AppError(status.NOT_FOUND, "Event not found.");
        }

        if (invitation.event.status !== EventStatus.PUBLISHED) {
            throw new AppError(
                status.BAD_REQUEST,
                "Only published events can accept paid invitations.",
            );
        }

        if (invitation.event.pricingType !== EventPricingType.PAID) {
            throw new AppError(
                status.BAD_REQUEST,
                "This invitation does not require payment.",
            );
        }

        ensureSupportedSslCommerzAmount(
            toMoneyNumber(invitation.event.registrationFee),
        );

        const existingParticipant = await tx.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId: invitation.eventId,
                    userId: authUser.userId,
                },
            },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
            },
        });

        if (existingParticipant?.status === ParticipantStatus.BANNED) {
            throw new AppError(
                status.FORBIDDEN,
                "You have been banned from this event.",
            );
        }

        if (existingParticipant?.status === ParticipantStatus.APPROVED) {
            throw new AppError(
                status.CONFLICT,
                "You are already participating in this event.",
            );
        }

        if (invitation.paymentStatus === PaymentStatus.PAID) {
            throw new AppError(
                status.CONFLICT,
                "Payment has already been completed for this invitation.",
            );
        }

        const reusablePayment = await getReusablePendingPayment(tx, {
            invitationId: invitation.id,
        });

        if (
            SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION &&
            reusablePayment &&
            getPaymentRedirectUrlFromGatewayPayload(reusablePayment.gatewayPayload)
        ) {
            return {
                payment: reusablePayment,
                customer: {
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone?.trim() || "01700000000",
                },
                reused: true,
            };
        }

        await cancelPendingPaymentsForSource(tx, {
            invitationId: invitation.id,
        });

        await tx.invitation.update({
            where: {
                id: invitation.id,
            },
            data: {
                paymentStatus: PaymentStatus.PENDING,
            },
        });

        const payment = await tx.payment.create({
            data: {
                userId: authUser.userId,
                eventId: invitation.eventId,
                invitationId: invitation.id,
                provider: PaymentProvider.SSLCOMMERZ,
                purpose: PaymentPurpose.INVITATION_ACCEPTANCE,
                amount: invitation.event.registrationFee,
                currency: invitation.event.currency,
                status: PaymentStatus.PENDING,
                expiresAt: new Date(Date.now() + PAYMENT_SESSION_EXPIRES_IN_MS),
                gatewayPayload: {
                    initiation: {
                        createdAt: new Date().toISOString(),
                    },
                },
            },
            select: paymentSelect,
        });

        return {
            payment,
            customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone?.trim() || "01700000000",
            },
            reused: false,
        };
    }, {
        timeout: PAYMENT_INITIATION_TRANSACTION_TIMEOUT_MS,
        maxWait: PAYMENT_INITIATION_TRANSACTION_MAX_WAIT_MS,
    });

    if (result.reused) {
        return {
            paymentId: result.payment.id,
            status: result.payment.status,
            redirectUrl:
                getPaymentRedirectUrlFromGatewayPayload(result.payment.gatewayPayload) ??
                "",
            payment: formatPayment(result.payment),
        };
    }

    return initializeHostedSessionForPayment(result.payment, result.customer);
};

const getVerificationStatus = (
    verification: TSslCommerzValidationRecord,
): string =>
    typeof verification.status === "string"
        ? verification.status.toUpperCase()
        : "";

const moneyMatches = (
    expectedAmount: number,
    actualAmount: string | undefined,
): boolean => {
    if (!actualAmount) {
        return true;
    }

    const parsedAmount = Number(actualAmount);

    if (!Number.isFinite(parsedAmount)) {
        return false;
    }

    return parsedAmount.toFixed(2) === expectedAmount.toFixed(2);
};

const getSuccessfulPaymentManualReviewReason = (
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
): string | null => {
    if (verification.tran_id && verification.tran_id !== payment.id) {
        return "Transaction id mismatch detected during payment verification.";
    }

    if (verification.value_a && verification.value_a !== payment.id) {
        return "Payment metadata mismatch detected during payment verification.";
    }

    const amountMatches = moneyMatches(
        toMoneyNumber(payment.amount),
        verification.currency_amount ?? verification.amount,
    );

    if (!amountMatches) {
        return "The verified payment amount does not match the expected registration fee.";
    }

    const verifiedCurrency =
        typeof verification.currency_type === "string"
            ? verification.currency_type.toUpperCase()
            : typeof verification.currency === "string"
              ? verification.currency.toUpperCase()
              : "";

    if (verifiedCurrency && verifiedCurrency !== payment.currency.toUpperCase()) {
        return "The verified payment currency does not match the expected event currency.";
    }

    return null;
};

const finalizeSuccessfulEventRegistrationPayment = async (
    tx: Prisma.TransactionClient,
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
) => {
    const manualReviewReasonFromVerification =
        getSuccessfulPaymentManualReviewReason(payment, verification);

    let manualReviewReason = manualReviewReasonFromVerification;

    if (!manualReviewReason) {
        if (payment.event.isDeleted) {
            manualReviewReason =
                "Payment captured after the event was deleted. Manual refund review is required.";
        } else if (payment.event.status !== EventStatus.PUBLISHED) {
            manualReviewReason =
                "Payment captured after the event was no longer published. Manual review is required.";
        } else if (!payment.participant) {
            manualReviewReason =
                "Payment captured without an attached participant record. Manual review is required.";
        } else if (payment.participant.status === ParticipantStatus.BANNED) {
            manualReviewReason =
                "Payment captured for a banned participant. Manual refund review is required.";
        } else if (payment.participant.status === ParticipantStatus.REJECTED) {
            manualReviewReason =
                "Payment captured after the participation request was rejected. Manual review is required.";
        }
    }

    const updatedPayment = await tx.payment.update({
        where: {
            id: payment.id,
        },
        data: {
            status: PaymentStatus.PAID,
            providerTransactionId:
                verification.bank_tran_id ?? payment.providerTransactionId,
            gatewayStatus: getVerificationStatus(verification) || "VALID",
            paidAt: payment.paidAt ?? new Date(),
            failureReason: null,
            gatewayPayload: buildPaymentVerificationGatewayPayload(
                payment,
                verification,
                callbackPayload,
                manualReviewReason,
            ),
        },
        select: paymentSelect,
    });

    if (payment.participant) {
        await tx.eventParticipant.update({
            where: {
                id: payment.participant.id,
            },
            data: {
                status:
                    payment.participant.status === ParticipantStatus.CANCELLED
                        ? ParticipantStatus.PENDING
                        : payment.participant.status,
                paymentStatus: PaymentStatus.PAID,
                approvalNote: null,
                rejectionReason:
                    payment.participant.status === ParticipantStatus.CANCELLED
                        ? null
                        : payment.participant.rejectionReason,
            },
        });
    }

    await createPaymentNotification(
        tx,
        updatedPayment,
        NotificationType.PAYMENT_SUCCESS,
        "Payment received",
        manualReviewReason
            ? "Your payment was received, but the registration needs manual review before access can be finalized."
            : "Your payment was received successfully and the registration is awaiting organizer approval.",
    );

    return updatedPayment;
};

const finalizeSuccessfulInvitationAcceptancePayment = async (
    tx: Prisma.TransactionClient,
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
) => {
    const manualReviewReasonFromVerification =
        getSuccessfulPaymentManualReviewReason(payment, verification);

    let manualReviewReason = manualReviewReasonFromVerification;

    if (!manualReviewReason) {
        if (!payment.invitation) {
            manualReviewReason =
                "Payment captured without an attached invitation record. Manual review is required.";
        } else if (payment.invitation.inviteeId !== payment.userId) {
            manualReviewReason =
                "Invitation ownership mismatch detected during payment verification.";
        } else if (payment.event.isDeleted) {
            manualReviewReason =
                "Payment captured after the event was deleted. Manual refund review is required.";
        } else if (payment.event.status !== EventStatus.PUBLISHED) {
            manualReviewReason =
                "Payment captured after the event was no longer published. Manual review is required.";
        } else if (
            payment.invitation.expiresAt &&
            payment.invitation.expiresAt <= new Date()
        ) {
            manualReviewReason =
                "Payment completed after the invitation expired. Manual review is required.";
        } else if (payment.participant?.status === ParticipantStatus.BANNED) {
            manualReviewReason =
                "Payment captured for a banned participant. Manual refund review is required.";
        } else {
            try {
                await ensureEventHasCapacity(
                    tx,
                    payment.eventId,
                    payment.event.capacity,
                );
            } catch (error) {
                if (error instanceof AppError) {
                    manualReviewReason =
                        "Payment was received after event capacity had already been reached. Manual refund review is required.";
                } else {
                    throw error;
                }
            }
        }
    }

    const updatedPayment = await tx.payment.update({
        where: {
            id: payment.id,
        },
        data: {
            status: PaymentStatus.PAID,
            providerTransactionId:
                verification.bank_tran_id ?? payment.providerTransactionId,
            gatewayStatus: getVerificationStatus(verification) || "VALID",
            paidAt: payment.paidAt ?? new Date(),
            failureReason: null,
            gatewayPayload: buildPaymentVerificationGatewayPayload(
                payment,
                verification,
                callbackPayload,
                manualReviewReason,
            ),
        },
        select: paymentSelect,
    });

    if (payment.invitation) {
        if (!manualReviewReason) {
            const now = new Date();

            if (
                payment.participant &&
                payment.participant.status !== ParticipantStatus.APPROVED
            ) {
                await tx.eventParticipant.update({
                    where: {
                        id: payment.participant.id,
                    },
                    data: {
                        joinType: ParticipationJoinType.INVITED,
                        status: ParticipantStatus.APPROVED,
                        paymentStatus: PaymentStatus.PAID,
                        approvalNote: null,
                        rejectionReason: null,
                        approvedById: payment.invitation.invitedById,
                        respondedAt: now,
                        approvedAt: now,
                        joinedAt: now,
                        bannedAt: null,
                    },
                });
            } else if (!payment.participant) {
                await tx.eventParticipant.create({
                    data: {
                        eventId: payment.eventId,
                        userId: payment.userId,
                        joinType: ParticipationJoinType.INVITED,
                        status: ParticipantStatus.APPROVED,
                        paymentStatus: PaymentStatus.PAID,
                        approvedById: payment.invitation.invitedById,
                        respondedAt: now,
                        approvedAt: now,
                        joinedAt: now,
                    },
                });
            }

            await tx.invitation.update({
                where: {
                    id: payment.invitation.id,
                },
                data: {
                    status: InvitationStatus.ACCEPTED,
                    paymentStatus: PaymentStatus.PAID,
                    respondedAt: now,
                    acceptedAt: now,
                    declinedAt: null,
                },
            });
        } else {
            await tx.invitation.update({
                where: {
                    id: payment.invitation.id,
                },
                data: {
                    paymentStatus: PaymentStatus.PAID,
                },
            });
        }
    }

    await createPaymentNotification(
        tx,
        updatedPayment,
        NotificationType.PAYMENT_SUCCESS,
        "Payment received",
        manualReviewReason
            ? "Your invitation payment was received, but the invitation needs manual review before access can be finalized."
            : "Your invitation payment was received successfully and the invitation has been accepted.",
    );

    return updatedPayment;
};

const finalizeFailedPayment = async (
    tx: Prisma.TransactionClient,
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
    terminalStatus: PaymentStatus,
) => {
    const failureReason = getCallbackFailureReason(verification, callbackPayload);
    const updatedPayment = await tx.payment.update({
        where: {
            id: payment.id,
        },
        data: {
            status: terminalStatus,
            gatewayStatus: getVerificationStatus(verification) || terminalStatus,
            failureReason,
            gatewayPayload: mergeGatewayPayload(payment.gatewayPayload, {
                verification,
                lastCallbackPayload: callbackPayload,
            }),
        },
        select: paymentSelect,
    });

    if (
        payment.purpose === PaymentPurpose.EVENT_REGISTRATION &&
        payment.participant
    ) {
        await tx.eventParticipant.update({
            where: {
                id: payment.participant.id,
            },
            data: {
                status: ParticipantStatus.CANCELLED,
                paymentStatus: terminalStatus,
                approvalNote: null,
                rejectionReason: null,
                approvedById: null,
                respondedAt: null,
                approvedAt: null,
                joinedAt: null,
            },
        });
    }

    if (
        payment.purpose === PaymentPurpose.INVITATION_ACCEPTANCE &&
        payment.invitation
    ) {
        await tx.invitation.update({
            where: {
                id: payment.invitation.id,
            },
            data: {
                paymentStatus: terminalStatus,
            },
        });
    }

    await createPaymentNotification(
        tx,
        updatedPayment,
        NotificationType.PAYMENT_FAILED,
        terminalStatus === PaymentStatus.CANCELLED
            ? "Payment cancelled"
            : "Payment failed",
        failureReason,
    );

    return updatedPayment;
};

const processVerifiedPaymentUpdate = async (
    payment: PaymentRecord,
    verification: TSslCommerzValidationRecord,
    callbackPayload: TSslCommerzCallbackPayload,
    callbackOutcome: TSslCommerzCallbackParams["outcome"] | "ipn",
) => {
    const verificationStatus = getVerificationStatus(verification);

    if (verificationStatus === "VALID" || verificationStatus === "VALIDATED") {
        return prisma.$transaction((tx) => {
            if (payment.purpose === PaymentPurpose.EVENT_REGISTRATION) {
                return finalizeSuccessfulEventRegistrationPayment(
                    tx,
                    payment,
                    verification,
                    callbackPayload,
                );
            }

            return finalizeSuccessfulInvitationAcceptancePayment(
                tx,
                payment,
                verification,
                callbackPayload,
            );
        });
    }

    if (verificationStatus === "PENDING") {
        return prisma.payment.update({
            where: {
                id: payment.id,
            },
            data: {
                gatewayStatus: "PENDING",
                gatewayPayload: mergeGatewayPayload(payment.gatewayPayload, {
                    verification,
                    lastCallbackPayload: callbackPayload,
                }),
            },
            select: paymentSelect,
        });
    }

    const terminalStatus =
        callbackOutcome === "cancel"
            ? PaymentStatus.CANCELLED
            : PaymentStatus.FAILED;

    return prisma.$transaction((tx) =>
        finalizeFailedPayment(
            tx,
            payment,
            verification,
            callbackPayload,
            terminalStatus,
        ),
    );
};

const buildPaymentWhereClause = (
    user: IAuthUser,
    query: TListMyPaymentsQuery,
): Prisma.PaymentWhereInput => {
    const whereClause: Prisma.PaymentWhereInput = {
        userId: user.userId,
    };

    if (query.status) {
        whereClause.status = query.status;
    }

    if (query.purpose) {
        whereClause.purpose = query.purpose;
    }

    if (query.searchTerm) {
        whereClause.OR = [
            {
                event: {
                    is: {
                        title: {
                            contains: query.searchTerm,
                            mode: "insensitive",
                        },
                    },
                },
            },
            {
                id: {
                    contains: query.searchTerm,
                    mode: "insensitive",
                },
            },
        ];
    }

    return whereClause;
};

const getPaymentRecordById = async (paymentId: string) => {
    const payment = await prisma.payment.findUnique({
        where: {
            id: paymentId,
        },
        select: paymentSelect,
    });

    if (!payment) {
        throw new AppError(status.NOT_FOUND, "Payment not found.");
    }

    return payment;
};

const initiatePayment = async (
    user: IAuthUser | undefined,
    payload: TInitiatePaymentPayload,
) => {
    const authUser = ensureRequestUser(user);

    if (payload.purpose === PaymentPurpose.EVENT_REGISTRATION) {
        return prepareEventRegistrationPayment(authUser, payload);
    }

    return prepareInvitationAcceptancePayment(authUser, payload);
};

const listMyPayments = async (
    user: IAuthUser | undefined,
    query: TListMyPaymentsQuery,
): Promise<IQueryResult<ReturnType<typeof formatPayment>>> => {
    const authUser = ensureRequestUser(user);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const whereClause = buildPaymentWhereClause(authUser, query);
    const orderBy: Prisma.PaymentOrderByWithRelationInput = {
        [query.sortBy]: query.sortOrder,
    };

    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where: whereClause,
            select: paymentSelect,
            orderBy,
            skip,
            take: limit,
        }),
        prisma.payment.count({
            where: whereClause,
        }),
    ]);

    return {
        data: payments.map(formatPayment),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const getPaymentById = async (
    user: IAuthUser | undefined,
    { id }: TPaymentIdParams,
) => {
    const authUser = ensureRequestUser(user);
    const payment = await getPaymentRecordById(id);

    if (authUser.role !== UserRole.ADMIN && payment.userId !== authUser.userId) {
        throw new AppError(
            status.FORBIDDEN,
            "You do not have permission to access this payment.",
        );
    }

    return formatPayment(payment);
};

const handleGatewayCallback = async (
    { outcome }: TSslCommerzCallbackParams,
    payload: TSslCommerzCallbackPayload,
) => {
    console.info("SSLCommerz callback payload", payload);

    const paymentId = payload.tran_id ?? null;

    if (!paymentId) {
        return {
            redirectUrl: buildFrontendPaymentReturnUrl(null, "INVALID"),
        };
    }

    let payment: PaymentRecord;

    try {
        payment = await getPaymentRecordById(paymentId);
    } catch {
        return {
            redirectUrl: buildFrontendPaymentReturnUrl(paymentId, "INVALID"),
        };
    }

    if (isTerminalPaymentStatus(payment.status)) {
        return {
            redirectUrl: buildFrontendPaymentReturnUrl(payment.id, payment.status),
        };
    }

    try {
        const verification = await verifySslCommerzPayment(
            payment.id,
            payload.val_id ?? null,
        );
        logSslCommerzVerification(payment.id, verification);
        const updatedPayment = await processVerifiedPaymentUpdate(
            payment,
            verification,
            payload,
            outcome,
        );

        return {
            redirectUrl: buildFrontendPaymentReturnUrl(
                updatedPayment.id,
                updatedPayment.status,
            ),
        };
    } catch {
        return {
            redirectUrl: buildFrontendPaymentReturnUrl(payment.id, "PENDING"),
        };
    }
};

const handleGatewayIpn = async (payload: TSslCommerzCallbackPayload) => {
    console.info("SSLCommerz IPN payload", payload);

    const paymentId = payload.tran_id;

    if (!paymentId) {
        throw new AppError(
            status.BAD_REQUEST,
            "Transaction id is required to process payment notification.",
        );
    }

    const payment = await getPaymentRecordById(paymentId);

    if (isTerminalPaymentStatus(payment.status)) {
        return formatPayment(payment);
    }

    const verification = await verifySslCommerzPayment(
        payment.id,
        payload.val_id ?? null,
    );
    logSslCommerzVerification(payment.id, verification);
    const updatedPayment = await processVerifiedPaymentUpdate(
        payment,
        verification,
        payload,
        "ipn",
    );

    return formatPayment(updatedPayment);
};

export const PaymentServices = {
    initiatePayment,
    listMyPayments,
    getPaymentById,
    handleGatewayCallback,
    handleGatewayIpn,
};
