import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    EventLocationType,
    EventPricingType,
    EventStatus,
    EventVisibility,
    InvitationStatus,
    ParticipantStatus,
    PaymentStatus,
    UserRole,
} from "../../../generated/prisma/enums";
import { envVars } from "../../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import { IQueryResult } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
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

const eventCardSelect = {
    id: true,
    title: true,
    slug: true,
    summary: true,
    startsAt: true,
    endsAt: true,
    timezone: true,
    locationType: true,
    venue: true,
    eventLink: true,
    visibility: true,
    pricingType: true,
    registrationFee: true,
    currency: true,
    bannerImage: true,
    isFeatured: true,
    owner: {
        select: {
            id: true,
            name: true,
            image: true,
        },
    },
} as const;

const eventDetailSelect = {
    ...eventCardSelect,
    description: true,
    capacity: true,
    createdAt: true,
    updatedAt: true,
} as const;

const managedEventSelect = {
    ...eventDetailSelect,
    status: true,
    _count: {
        select: {
            participants: true,
        },
    },
} as const;

const editableEventSelect = {
    id: true,
    slug: true,
    ownerId: true,
    isDeleted: true,
    title: true,
    summary: true,
    description: true,
    startsAt: true,
    endsAt: true,
    timezone: true,
    locationType: true,
    venue: true,
    eventLink: true,
    visibility: true,
    pricingType: true,
    registrationFee: true,
    currency: true,
    capacity: true,
    bannerImage: true,
    status: true,
} as const;

const eventParticipantSelect = {
    id: true,
    joinType: true,
    status: true,
    paymentStatus: true,
    approvalNote: true,
    rejectionReason: true,
    respondedAt: true,
    approvedAt: true,
    joinedAt: true,
    bannedAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
        },
    },
    approvedBy: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
} as const;

const eventAccessStateSelect = {
    ...eventDetailSelect,
    ownerId: true,
} as const;

const accessStateInvitationSelect = {
    id: true,
    status: true,
    paymentStatus: true,
    message: true,
    expiresAt: true,
    respondedAt: true,
    acceptedAt: true,
    declinedAt: true,
    createdAt: true,
    updatedAt: true,
    invitedBy: {
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
        },
    },
} as const;

const accessStateParticipantSelect = {
    id: true,
    joinType: true,
    status: true,
    paymentStatus: true,
    approvalNote: true,
    rejectionReason: true,
    respondedAt: true,
    approvedAt: true,
    joinedAt: true,
    bannedAt: true,
    createdAt: true,
    updatedAt: true,
    approvedBy: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
} as const;

const accessStatePaymentSelect = {
    id: true,
    purpose: true,
    provider: true,
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
} as const;

type EventCardRecord = Prisma.EventGetPayload<{
    select: typeof eventCardSelect;
}>;

type EventDetailRecord = Prisma.EventGetPayload<{
    select: typeof eventDetailSelect;
}>;

type ManagedEventRecord = Prisma.EventGetPayload<{
    select: typeof managedEventSelect;
}>;

type EditableEventRecord = Prisma.EventGetPayload<{
    select: typeof editableEventSelect;
}>;

type EventParticipantRecord = Prisma.EventParticipantGetPayload<{
    select: typeof eventParticipantSelect;
}>;

type EventAccessStateRecord = Prisma.EventGetPayload<{
    select: typeof eventAccessStateSelect;
}>;

type AccessStateInvitationRecord = Prisma.InvitationGetPayload<{
    select: typeof accessStateInvitationSelect;
}>;

type AccessStateParticipantRecord = Prisma.EventParticipantGetPayload<{
    select: typeof accessStateParticipantSelect;
}>;

type AccessStatePaymentRecord = Prisma.PaymentGetPayload<{
    select: typeof accessStatePaymentSelect;
}>;

type EventState = {
    title: string;
    summary: string | null;
    description: string;
    startsAt: Date;
    endsAt: Date | null;
    timezone: string;
    locationType: EventLocationType;
    venue: string | null;
    eventLink: string | null;
    visibility: EventVisibility;
    pricingType: EventPricingType;
    registrationFee: number;
    currency: string;
    capacity: number | null;
    bannerImage: string | null;
    status: EventStatus;
};

const SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION = !envVars.SSLCOMMERZ_IS_SANDBOX;

type EventAccessPrimaryAction =
    | "LOG_IN"
    | "MANAGE_EVENT"
    | "VIEW_PARTICIPATION"
    | "VIEW_INVITATIONS"
    | "JOIN_EVENT"
    | "REQUEST_ACCESS"
    | "PAY_TO_REQUEST_ACCESS"
    | "PAY_INVITATION"
    | "ACCEPT_INVITATION"
    | "COMPLETE_PAYMENT"
    | "NONE";

const toMoneyNumber = (value: Prisma.Decimal | number) =>
    typeof value === "number" ? value : Number(value.toString());

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

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
        initialization &&
        typeof initialization.redirectGatewayURL === "string"
            ? initialization.redirectGatewayURL.trim()
            : "";

    return redirectGatewayUrl || null;
};

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

const formatEventCard = (event: EventCardRecord) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    summary: event.summary,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    locationType: event.locationType,
    venue: event.venue,
    eventLink: event.eventLink,
    visibility: event.visibility,
    pricingType: event.pricingType,
    registrationFee: toMoneyNumber(event.registrationFee),
    currency: event.currency,
    bannerImage: event.bannerImage,
    isFeatured: event.isFeatured,
    owner: event.owner,
    ...getEventAccessPolicy(event.visibility, event.pricingType),
});

const formatEventDetail = (event: EventDetailRecord) => ({
    ...formatEventCard(event),
    description: event.description,
    capacity: event.capacity,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
});

const formatManagedEvent = (event: ManagedEventRecord) => ({
    ...formatEventDetail(event),
    status: event.status,
    participantCount: event._count.participants,
});

const formatEventParticipant = (participant: EventParticipantRecord) => ({
    id: participant.id,
    joinType: participant.joinType,
    status: participant.status,
    paymentStatus: participant.paymentStatus,
    approvalNote: participant.approvalNote,
    rejectionReason: participant.rejectionReason,
    respondedAt: participant.respondedAt,
    approvedAt: participant.approvedAt,
    joinedAt: participant.joinedAt,
    bannedAt: participant.bannedAt,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
    user: participant.user,
    approvedBy: participant.approvedBy,
});

const formatEventAccessInvitation = (invitation: AccessStateInvitationRecord) => ({
    id: invitation.id,
    status: invitation.status,
    paymentStatus: invitation.paymentStatus,
    message: invitation.message,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt,
    acceptedAt: invitation.acceptedAt,
    declinedAt: invitation.declinedAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    invitedBy: invitation.invitedBy,
});

const formatEventAccessParticipant = (
    participant: AccessStateParticipantRecord,
) => ({
    id: participant.id,
    joinType: participant.joinType,
    status: participant.status,
    paymentStatus: participant.paymentStatus,
    approvalNote: participant.approvalNote,
    rejectionReason: participant.rejectionReason,
    respondedAt: participant.respondedAt,
    approvedAt: participant.approvedAt,
    joinedAt: participant.joinedAt,
    bannedAt: participant.bannedAt,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
    approvedBy: participant.approvedBy,
});

const formatEventAccessPayment = (payment: AccessStatePaymentRecord) => ({
    id: payment.id,
    purpose: payment.purpose,
    provider: payment.provider,
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
    redirectUrl: SHOULD_REUSE_PENDING_SSL_COMMERZ_SESSION
        ? getPaymentRedirectUrlFromGatewayPayload(payment.gatewayPayload)
        : null,
    manualReviewReason: getManualReviewReason(payment.gatewayPayload),
    requiresManualReview: Boolean(getManualReviewReason(payment.gatewayPayload)),
});

const getPaymentRecoveryState = (
    latestPayment:
        | ReturnType<typeof formatEventAccessPayment>
        | null,
    primaryAction: Extract<
        EventAccessPrimaryAction,
        "PAY_TO_REQUEST_ACCESS" | "PAY_INVITATION"
    >,
    statePrefix: "REGISTRATION" | "INVITATION" | "PAYMENT",
    defaultReason: string,
) => {
    if (
        latestPayment?.status === PaymentStatus.PENDING &&
        latestPayment.redirectUrl
    ) {
        return {
            state: `${statePrefix}_PENDING`,
            primaryAction: "COMPLETE_PAYMENT" as const,
            reason: "You already have a pending payment session for this event.",
        };
    }

    if (latestPayment?.status === PaymentStatus.FAILED) {
        return {
            state: `${statePrefix}_FAILED`,
            primaryAction,
            reason: latestPayment.failureReason ?? "Your last payment attempt failed.",
        };
    }

    if (latestPayment?.status === PaymentStatus.CANCELLED) {
        return {
            state: `${statePrefix}_CANCELLED`,
            primaryAction,
            reason: "Your last payment attempt was cancelled.",
        };
    }

    if (latestPayment?.status === PaymentStatus.REFUNDED) {
        return {
            state: `${statePrefix}_REFUNDED`,
            primaryAction,
            reason: "Your previous payment was refunded.",
        };
    }

    return {
        state: `${statePrefix}_REQUIRED`,
        primaryAction,
        reason: defaultReason,
    };
};

const deriveEventAccessState = ({
    user,
    event,
    invitation,
    participation,
    latestPayment,
}: {
    user?: IAuthUser;
    event: EventAccessStateRecord;
    invitation: ReturnType<typeof formatEventAccessInvitation> | null;
    participation: ReturnType<typeof formatEventAccessParticipant> | null;
    latestPayment: ReturnType<typeof formatEventAccessPayment> | null;
}) => {
    if (!user) {
        return {
            state: "GUEST",
            primaryAction: "LOG_IN" as const,
            reason: "Log in to continue.",
        };
    }

    if (event.ownerId === user.userId || user.role === UserRole.ADMIN) {
        return {
            state: "CAN_MANAGE_EVENT",
            primaryAction: "MANAGE_EVENT" as const,
            reason: "You can manage this event.",
        };
    }

    if (participation?.status === ParticipantStatus.BANNED) {
        return {
            state: "BANNED",
            primaryAction: "NONE" as const,
            reason: "You have been banned from this event.",
        };
    }

    if (participation?.status === ParticipantStatus.APPROVED) {
        return {
            state: "PARTICIPATING",
            primaryAction: "VIEW_PARTICIPATION" as const,
            reason: "You already have access to this event.",
        };
    }

    if (participation?.status === ParticipantStatus.REJECTED) {
        return {
            state: "PARTICIPATION_REJECTED",
            primaryAction: "NONE" as const,
            reason:
                participation.rejectionReason ??
                "Your previous participation request was rejected.",
        };
    }

    if (invitation?.status === InvitationStatus.PENDING) {
        if (event.pricingType === EventPricingType.PAID) {
            if (invitation.paymentStatus === PaymentStatus.PAID) {
                return {
                    state: latestPayment?.requiresManualReview
                        ? "INVITATION_PAYMENT_UNDER_REVIEW"
                        : "INVITATION_PAYMENT_COMPLETED",
                    primaryAction: "VIEW_INVITATIONS" as const,
                    reason:
                        latestPayment?.manualReviewReason ??
                        "Payment was received for this invitation.",
                };
            }

            return getPaymentRecoveryState(
                latestPayment,
                "PAY_INVITATION",
                "INVITATION",
                "This invitation requires payment before it can be accepted.",
            );
        }

        return {
            state: "INVITED",
            primaryAction: "ACCEPT_INVITATION" as const,
            reason: "You have a pending invitation for this event.",
        };
    }

    if (invitation?.status === InvitationStatus.ACCEPTED) {
        return {
            state: "INVITATION_ACCEPTED",
            primaryAction: "VIEW_INVITATIONS" as const,
            reason: "This invitation has already been accepted.",
        };
    }

    if (participation?.status === ParticipantStatus.PENDING) {
        if (participation.paymentStatus === PaymentStatus.PAID) {
            return {
                state: latestPayment?.requiresManualReview
                    ? "REGISTRATION_UNDER_REVIEW"
                    : "AWAITING_APPROVAL",
                primaryAction: "VIEW_PARTICIPATION" as const,
                reason:
                    latestPayment?.manualReviewReason ??
                    "Your registration is awaiting organizer approval.",
            };
        }

        if (event.pricingType === EventPricingType.PAID) {
            return getPaymentRecoveryState(
                latestPayment,
                "PAY_TO_REQUEST_ACCESS",
                "REGISTRATION",
                "This event requires payment before your access request can be processed.",
            );
        }

        return {
            state: "PARTICIPATION_PENDING",
            primaryAction: "VIEW_PARTICIPATION" as const,
            reason: "Your access request is awaiting organizer approval.",
        };
    }

    if (event.pricingType === EventPricingType.PAID) {
        return getPaymentRecoveryState(
            latestPayment,
            "PAY_TO_REQUEST_ACCESS",
            "PAYMENT",
            "Payment is required before access can be requested.",
        );
    }

    if (event.visibility === EventVisibility.PUBLIC) {
        return {
            state: "CAN_JOIN",
            primaryAction: "JOIN_EVENT" as const,
            reason: null,
        };
    }

    return {
        state: "CAN_REQUEST_ACCESS",
        primaryAction: "REQUEST_ACCESS" as const,
        reason: "This event requires organizer approval.",
    };
};

const ensureRequestUser = (user?: IAuthUser): IAuthUser => {
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
    }

    return user;
};

const ensureCanManageEvent = (
    event: {
        ownerId: string;
        isDeleted: boolean;
    },
    user: IAuthUser,
) => {
    if (event.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    if (user.role === UserRole.ADMIN) {
        return;
    }

    if (event.ownerId !== user.userId) {
        throw new AppError(
            status.FORBIDDEN,
            "You do not have permission to manage this event.",
        );
    }
};

const buildPublicPublishedEventWhereClause = (): Prisma.EventWhereInput => ({
    status: EventStatus.PUBLISHED,
    isDeleted: false,
    visibility: EventVisibility.PUBLIC,
});

const buildPublicEventListWhereClause = (
    query: TListEventsQuery,
): Prisma.EventWhereInput => {
    const whereClause: Prisma.EventWhereInput = {
        ...buildPublicPublishedEventWhereClause(),
    };

    if (query.pricingType) {
        whereClause.pricingType = query.pricingType;
    }

    if (query.locationType) {
        whereClause.locationType = query.locationType;
    }

    if (query.searchTerm) {
        whereClause.OR = [
            {
                title: {
                    contains: query.searchTerm,
                    mode: "insensitive",
                },
            },
            {
                owner: {
                    is: {
                        name: {
                            contains: query.searchTerm,
                            mode: "insensitive",
                        },
                    },
                },
            },
        ];
    }

    return whereClause;
};

const buildMyEventsWhereClause = (
    user: IAuthUser,
    query: TListMyEventsQuery,
): Prisma.EventWhereInput => {
    const whereClause: Prisma.EventWhereInput = {
        ownerId: user.userId,
        isDeleted: false,
    };

    if (query.status) {
        whereClause.status = query.status;
    }

    if (query.visibility) {
        whereClause.visibility = query.visibility;
    }

    if (query.pricingType) {
        whereClause.pricingType = query.pricingType;
    }

    if (query.locationType) {
        whereClause.locationType = query.locationType;
    }

    if (query.searchTerm) {
        whereClause.OR = [
            {
                title: {
                    contains: query.searchTerm,
                    mode: "insensitive",
                },
            },
            {
                summary: {
                    contains: query.searchTerm,
                    mode: "insensitive",
                },
            },
        ];
    }

    return whereClause;
};

const buildParticipantWhereClause = (
    eventId: string,
    query: TListEventParticipantsQuery,
): Prisma.EventParticipantWhereInput => {
    const whereClause: Prisma.EventParticipantWhereInput = {
        eventId,
    };

    if (query.status) {
        whereClause.status = query.status;
    }

    if (query.searchTerm) {
        whereClause.user = {
            is: {
                OR: [
                    {
                        name: {
                            contains: query.searchTerm,
                            mode: "insensitive",
                        },
                    },
                    {
                        email: {
                            contains: query.searchTerm,
                            mode: "insensitive",
                        },
                    },
                ],
            },
        };
    }

    return whereClause;
};

const slugifyTitle = (title: string) => {
    const normalizedTitle = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return normalizedTitle || `event-${Date.now()}`;
};

const generateUniqueEventSlug = async (
    title: string,
    excludeEventId?: string,
) => {
    const baseSlug = slugifyTitle(title);

    let candidateSlug = baseSlug;
    let suffix = 1;

    while (true) {
        const existingEvent = await prisma.event.findUnique({
            where: {
                slug: candidateSlug,
            },
            select: {
                id: true,
            },
        });

        if (!existingEvent || existingEvent.id === excludeEventId) {
            return candidateSlug;
        }

        suffix += 1;
        candidateSlug = `${baseSlug}-${suffix}`;
    }
};

const normalizeEventState = (state: EventState): EventState => {
    if (state.endsAt && state.endsAt <= state.startsAt) {
        throw new AppError(
            status.BAD_REQUEST,
            "Event end time must be after the start time.",
        );
    }

    const normalizedVenue =
        state.locationType === EventLocationType.OFFLINE ? state.venue : null;
    const normalizedEventLink =
        state.locationType === EventLocationType.ONLINE ? state.eventLink : null;

    if (
        state.locationType === EventLocationType.OFFLINE &&
        !normalizedVenue
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            "Venue is required for offline events.",
        );
    }

    if (
        state.locationType === EventLocationType.ONLINE &&
        !normalizedEventLink
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            "Event link is required for online events.",
        );
    }

    const normalizedRegistrationFee =
        state.pricingType === EventPricingType.FREE ? 0 : state.registrationFee;

    if (
        state.pricingType === EventPricingType.PAID &&
        normalizedRegistrationFee <= 0
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            "Paid events must have a registration fee greater than 0.",
        );
    }

    return {
        ...state,
        venue: normalizedVenue,
        eventLink: normalizedEventLink,
        registrationFee: normalizedRegistrationFee,
        currency: state.currency.toUpperCase(),
    };
};

const getEditableEventById = async (id: string) => {
    const event = await prisma.event.findUnique({
        where: {
            id,
        },
        select: editableEventSelect,
    });

    if (!event || event.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    return event;
};

const hasOwnProperty = <T extends object>(value: T, key: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(value, key);

const buildUpdateEventState = (
    event: EditableEventRecord,
    payload: TUpdateEventPayload,
): EventState =>
    normalizeEventState({
        title: payload.title ?? event.title,
        summary: hasOwnProperty(payload, "summary")
            ? payload.summary ?? null
            : event.summary,
        description: payload.description ?? event.description,
        startsAt: payload.startsAt ?? event.startsAt,
        endsAt: hasOwnProperty(payload, "endsAt")
            ? payload.endsAt ?? null
            : event.endsAt,
        timezone: payload.timezone ?? event.timezone,
        locationType: payload.locationType ?? event.locationType,
        venue: hasOwnProperty(payload, "venue")
            ? payload.venue ?? null
            : event.venue,
        eventLink: hasOwnProperty(payload, "eventLink")
            ? payload.eventLink ?? null
            : event.eventLink,
        visibility: payload.visibility ?? event.visibility,
        pricingType: payload.pricingType ?? event.pricingType,
        registrationFee:
            payload.registrationFee ?? toMoneyNumber(event.registrationFee),
        currency: payload.currency ?? event.currency,
        capacity: hasOwnProperty(payload, "capacity")
            ? payload.capacity ?? null
            : event.capacity,
        bannerImage: hasOwnProperty(payload, "bannerImage")
            ? payload.bannerImage ?? null
            : event.bannerImage,
        status: payload.status ?? event.status,
    });

const listEvents = async (
    query: TListEventsQuery,
): Promise<IQueryResult<ReturnType<typeof formatEventCard>>> => {
    const whereClause = buildPublicEventListWhereClause(query);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const orderBy: Prisma.EventOrderByWithRelationInput = {
        [query.sortBy]: query.sortOrder,
    };

    const [events, total] = await Promise.all([
        prisma.event.findMany({
            where: whereClause,
            select: eventCardSelect,
            orderBy,
            skip,
            take: limit,
        }),
        prisma.event.count({
            where: whereClause,
        }),
    ]);

    return {
        data: events.map(formatEventCard),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const getFeaturedEvent = async () => {
    const now = new Date();
    const featuredWhereClause: Prisma.EventWhereInput = {
        ...buildPublicPublishedEventWhereClause(),
        startsAt: {
            gte: now,
        },
    };

    const featuredEvent =
        (await prisma.event.findFirst({
            where: {
                ...featuredWhereClause,
                isFeatured: true,
            },
            select: eventDetailSelect,
            orderBy: [{ featuredAt: "desc" }, { startsAt: "asc" }],
        })) ??
        (await prisma.event.findFirst({
            where: featuredWhereClause,
            select: eventDetailSelect,
            orderBy: { startsAt: "asc" },
        }));

    return featuredEvent ? formatEventDetail(featuredEvent) : null;
};

const getUpcomingEvents = async (query: TGetUpcomingEventsQuery) => {
    const events = await prisma.event.findMany({
        where: {
            ...buildPublicPublishedEventWhereClause(),
            startsAt: {
                gte: new Date(),
            },
        },
        select: eventCardSelect,
        orderBy: {
            startsAt: "asc",
        },
        take: query.limit,
    });

    return events.map(formatEventCard);
};

const getEventBySlug = async ({ slug }: TEventSlugParams) => {
    const event = await prisma.event.findFirst({
        where: {
            ...buildPublicPublishedEventWhereClause(),
            slug,
        },
        select: eventDetailSelect,
    });

    if (!event) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    return formatEventDetail(event);
};

const getEventAccessState = async (
    { slug }: TEventSlugParams,
    user?: IAuthUser,
) => {
    const event = await prisma.event.findFirst({
        where: {
            ...buildPublicPublishedEventWhereClause(),
            slug,
        },
        select: eventAccessStateSelect,
    });

    if (!event) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    if (!user) {
        return {
            event: formatEventDetail(event),
            viewer: {
                isAuthenticated: false,
                userId: null,
                isHost: false,
                canManageEvent: false,
            },
            participation: null,
            invitation: null,
            latestPayment: null,
            accessState: deriveEventAccessState({
                event,
                user,
                invitation: null,
                participation: null,
                latestPayment: null,
            }),
        };
    }

    return prisma.$transaction(async (tx) => {
        let invitation = await tx.invitation.findFirst({
            where: {
                eventId: event.id,
                inviteeId: user.userId,
            },
            select: accessStateInvitationSelect,
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        });

        const now = new Date();

        if (
            invitation?.status === InvitationStatus.PENDING &&
            invitation.expiresAt &&
            invitation.expiresAt <= now
        ) {
            invitation = await tx.invitation.update({
                where: {
                    id: invitation.id,
                },
                data: {
                    status: InvitationStatus.EXPIRED,
                    respondedAt: now,
                },
                select: accessStateInvitationSelect,
            });
        }

        const [participation, latestPayment] = await Promise.all([
            tx.eventParticipant.findUnique({
                where: {
                    eventId_userId: {
                        eventId: event.id,
                        userId: user.userId,
                    },
                },
                select: accessStateParticipantSelect,
            }),
            tx.payment.findFirst({
                where: {
                    eventId: event.id,
                    userId: user.userId,
                },
                select: accessStatePaymentSelect,
                orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            }),
        ]);

        const formattedInvitation = invitation
            ? formatEventAccessInvitation(invitation)
            : null;
        const formattedParticipation = participation
            ? formatEventAccessParticipant(participation)
            : null;
        const formattedLatestPayment = latestPayment
            ? formatEventAccessPayment(latestPayment)
            : null;

        return {
            event: formatEventDetail(event),
            viewer: {
                isAuthenticated: true,
                userId: user.userId,
                isHost: event.ownerId === user.userId,
                canManageEvent:
                    event.ownerId === user.userId || user.role === UserRole.ADMIN,
            },
            participation: formattedParticipation,
            invitation: formattedInvitation,
            latestPayment: formattedLatestPayment,
            accessState: deriveEventAccessState({
                user,
                event,
                invitation: formattedInvitation,
                participation: formattedParticipation,
                latestPayment: formattedLatestPayment,
            }),
        };
    });
};

const createEvent = async (user: IAuthUser | undefined, payload: TCreateEventPayload) => {
    const authUser = ensureRequestUser(user);
    const normalizedEventState = normalizeEventState({
        title: payload.title,
        summary: payload.summary ?? null,
        description: payload.description,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt ?? null,
        timezone: payload.timezone,
        locationType: payload.locationType,
        venue: payload.venue ?? null,
        eventLink: payload.eventLink ?? null,
        visibility: payload.visibility,
        pricingType: payload.pricingType,
        registrationFee: payload.registrationFee,
        currency: payload.currency,
        capacity: payload.capacity ?? null,
        bannerImage: payload.bannerImage ?? null,
        status: payload.status,
    });

    const slug = await generateUniqueEventSlug(normalizedEventState.title);

    const createdEvent = await prisma.event.create({
        data: {
            ...normalizedEventState,
            slug,
            ownerId: authUser.userId,
        },
        select: managedEventSelect,
    });

    return formatManagedEvent(createdEvent);
};

const listMyEvents = async (
    user: IAuthUser | undefined,
    query: TListMyEventsQuery,
): Promise<IQueryResult<ReturnType<typeof formatManagedEvent>>> => {
    const authUser = ensureRequestUser(user);
    const whereClause = buildMyEventsWhereClause(authUser, query);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const orderBy: Prisma.EventOrderByWithRelationInput = {
        [query.sortBy]: query.sortOrder,
    };

    const [events, total] = await Promise.all([
        prisma.event.findMany({
            where: whereClause,
            select: managedEventSelect,
            orderBy,
            skip,
            take: limit,
        }),
        prisma.event.count({
            where: whereClause,
        }),
    ]);

    return {
        data: events.map(formatManagedEvent),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const updateEvent = async (
    user: IAuthUser | undefined,
    { id }: TEventIdParams,
    payload: TUpdateEventPayload,
) => {
    const authUser = ensureRequestUser(user);
    const event = await getEditableEventById(id);

    ensureCanManageEvent(event, authUser);

    const updatedEventState = buildUpdateEventState(event, payload);

    const updatedEvent = await prisma.event.update({
        where: {
            id,
        },
        data: updatedEventState,
        select: managedEventSelect,
    });

    return formatManagedEvent(updatedEvent);
};

const deleteEvent = async (user: IAuthUser | undefined, { id }: TEventIdParams) => {
    const authUser = ensureRequestUser(user);
    const event = await getEditableEventById(id);

    ensureCanManageEvent(event, authUser);

    await prisma.event.update({
        where: {
            id,
        },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
            status: EventStatus.CANCELLED,
            isFeatured: false,
            featuredAt: null,
        },
    });

    return {
        id: event.id,
        slug: event.slug,
        title: event.title,
    };
};

const getEventParticipants = async (
    user: IAuthUser | undefined,
    { id }: TEventIdParams,
    query: TListEventParticipantsQuery,
): Promise<
    IQueryResult<ReturnType<typeof formatEventParticipant>> & {
        event: {
            id: string;
            title: string;
        };
    }
> => {
    const authUser = ensureRequestUser(user);
    const event = await prisma.event.findUnique({
        where: {
            id,
        },
        select: {
            id: true,
            title: true,
            ownerId: true,
            isDeleted: true,
        },
    });

    if (!event || event.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    ensureCanManageEvent(
        {
            ownerId: event.ownerId,
            isDeleted: event.isDeleted,
        },
        authUser,
    );

    const whereClause = buildParticipantWhereClause(id, query);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
        prisma.eventParticipant.findMany({
            where: whereClause,
            select: eventParticipantSelect,
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
        prisma.eventParticipant.count({
            where: whereClause,
        }),
    ]);

    return {
        event: {
            id: event.id,
            title: event.title,
        },
        data: participants.map(formatEventParticipant),
        meta: buildPaginationMeta(page, limit, total),
    };
};

export const EventServices = {
    listEvents,
    getFeaturedEvent,
    getUpcomingEvents,
    getEventBySlug,
    getEventAccessState,
    createEvent,
    listMyEvents,
    updateEvent,
    deleteEvent,
    getEventParticipants,
};
