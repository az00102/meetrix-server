import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    EventPricingType,
    EventStatus,
    EventVisibility,
    InvitationStatus,
    ParticipantStatus,
    ParticipationJoinType,
    PaymentStatus,
    UserRole,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import { IQueryResult } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import {
    TApproveParticipantPayload,
    TBanParticipantPayload,
    TEventIdParams,
    TListMyParticipationsQuery,
    TParticipantIdParams,
    TRejectParticipantPayload,
} from "./participation.validation";

const participationRecordSelect = {
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
    event: {
        select: {
            id: true,
            title: true,
            slug: true,
            visibility: true,
            pricingType: true,
            registrationFee: true,
            currency: true,
            startsAt: true,
            owner: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    },
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

const participantModerationSelect = {
    id: true,
    userId: true,
    status: true,
    paymentStatus: true,
    joinType: true,
    respondedAt: true,
    approvedAt: true,
    joinedAt: true,
    bannedAt: true,
    rejectionReason: true,
    event: {
        select: {
            id: true,
            ownerId: true,
            isDeleted: true,
            title: true,
            slug: true,
            status: true,
            pricingType: true,
            visibility: true,
            capacity: true,
            registrationFee: true,
            currency: true,
        },
    },
} as const;

const eventParticipationContextSelect = {
    id: true,
    ownerId: true,
    isDeleted: true,
    title: true,
    slug: true,
    status: true,
    visibility: true,
    pricingType: true,
    capacity: true,
    registrationFee: true,
    currency: true,
} as const;

type ParticipationRecord = Prisma.EventParticipantGetPayload<{
    select: typeof participationRecordSelect;
}>;

type ParticipantModerationRecord = Prisma.EventParticipantGetPayload<{
    select: typeof participantModerationSelect;
}>;

type EventParticipationContext = Prisma.EventGetPayload<{
    select: typeof eventParticipationContextSelect;
}>;

const toMoneyNumber = (value: Prisma.Decimal) => Number(value.toString());

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

const formatParticipation = (participant: ParticipationRecord) => ({
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
    event: {
        id: participant.event.id,
        title: participant.event.title,
        slug: participant.event.slug,
        visibility: participant.event.visibility,
        pricingType: participant.event.pricingType,
        registrationFee: toMoneyNumber(participant.event.registrationFee),
        currency: participant.event.currency,
        startsAt: participant.event.startsAt,
        owner: participant.event.owner,
        ...getEventAccessPolicy(
            participant.event.visibility,
            participant.event.pricingType,
        ),
    },
    user: participant.user,
    approvedBy: participant.approvedBy,
});

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

const getEventParticipationContextOrThrow = async (
    tx: Prisma.TransactionClient,
    eventId: string,
) => {
    const event = await tx.event.findUnique({
        where: {
            id: eventId,
        },
        select: eventParticipationContextSelect,
    });

    if (!event || event.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Event not found.");
    }

    return event;
};

const getParticipantForModerationOrThrow = async (
    tx: Prisma.TransactionClient,
    participantId: string,
) => {
    const participant = await tx.eventParticipant.findUnique({
        where: {
            id: participantId,
        },
        select: participantModerationSelect,
    });

    if (!participant || participant.event.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Participant not found.");
    }

    return participant;
};

const ensureEventIsOpenForParticipation = (
    event: EventParticipationContext,
    user: IAuthUser,
) => {
    if (event.status !== EventStatus.PUBLISHED) {
        throw new AppError(
            status.BAD_REQUEST,
            "Only published events are open for participation.",
        );
    }

    if (event.ownerId === user.userId) {
        throw new AppError(
            status.BAD_REQUEST,
            "You cannot join or request access to your own event.",
        );
    }

    if (event.pricingType === EventPricingType.PAID) {
        throw new AppError(
            status.BAD_REQUEST,
            "Paid event participation requires payment integration and is not available yet.",
        );
    }
};

const ensureEventCanBeModerated = (participant: ParticipantModerationRecord) => {
    if (participant.event.status !== EventStatus.PUBLISHED) {
        throw new AppError(
            status.BAD_REQUEST,
            "Only published events can process participation moderation.",
        );
    }
};

const buildMyParticipationsWhereClause = (
    userId: string,
    query: TListMyParticipationsQuery,
): Prisma.EventParticipantWhereInput => {
    const whereClause: Prisma.EventParticipantWhereInput = {
        userId,
        event: {
            is: {
                isDeleted: false,
                ownerId: {
                    not: userId,
                },
            },
        },
    };

    if (query.status) {
        whereClause.status = query.status;
    }

    if (query.joinType) {
        whereClause.joinType = query.joinType;
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
                event: {
                    is: {
                        owner: {
                            is: {
                                name: {
                                    contains: query.searchTerm,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                },
            },
        ];
    }

    return whereClause;
};

const joinEvent = async (
    user: IAuthUser | undefined,
    { eventId }: TEventIdParams,
) => {
    const authUser = ensureRequestUser(user);

    const participant = await prisma.$transaction(async (tx) => {
        const event = await getEventParticipationContextOrThrow(tx, eventId);

        ensureEventIsOpenForParticipation(event, authUser);

        const [existingParticipant, pendingInvitation] = await Promise.all([
            tx.eventParticipant.findFirst({
                where: {
                    eventId,
                    userId: authUser.userId,
                },
                select: {
                    id: true,
                    status: true,
                },
            }),
            tx.invitation.findFirst({
                where: {
                    eventId,
                    inviteeId: authUser.userId,
                    status: InvitationStatus.PENDING,
                },
                select: {
                    id: true,
                },
            }),
        ]);

        if (pendingInvitation) {
            throw new AppError(
                status.CONFLICT,
                "You already have a pending invitation for this event. Please respond to that invitation instead.",
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

        if (existingParticipant?.status === ParticipantStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "You already have a pending participation request for this event.",
            );
        }

        const now = new Date();
        const isDirectJoin = event.visibility === EventVisibility.PUBLIC;

        if (isDirectJoin) {
            await ensureEventHasCapacity(tx, event.id, event.capacity);
        }

        if (existingParticipant) {
            return tx.eventParticipant.update({
                where: {
                    id: existingParticipant.id,
                },
                data: {
                    joinType: isDirectJoin
                        ? ParticipationJoinType.DIRECT
                        : ParticipationJoinType.REQUEST,
                    status: isDirectJoin
                        ? ParticipantStatus.APPROVED
                        : ParticipantStatus.PENDING,
                    paymentStatus: PaymentStatus.UNPAID,
                    approvalNote: null,
                    rejectionReason: null,
                    approvedById: null,
                    respondedAt: isDirectJoin ? now : null,
                    approvedAt: isDirectJoin ? now : null,
                    joinedAt: isDirectJoin ? now : null,
                    bannedAt: null,
                },
                select: participationRecordSelect,
            });
        }

        return tx.eventParticipant.create({
            data: {
                eventId: event.id,
                userId: authUser.userId,
                joinType: isDirectJoin
                    ? ParticipationJoinType.DIRECT
                    : ParticipationJoinType.REQUEST,
                status: isDirectJoin
                    ? ParticipantStatus.APPROVED
                    : ParticipantStatus.PENDING,
                paymentStatus: PaymentStatus.UNPAID,
                respondedAt: isDirectJoin ? now : null,
                approvedAt: isDirectJoin ? now : null,
                joinedAt: isDirectJoin ? now : null,
            },
            select: participationRecordSelect,
        });
    });

    return {
        action:
            participant.status === ParticipantStatus.APPROVED ? "joined" : "requested",
        participation: formatParticipation(participant),
    };
};

const listMyParticipations = async (
    user: IAuthUser | undefined,
    query: TListMyParticipationsQuery,
): Promise<IQueryResult<ReturnType<typeof formatParticipation>>> => {
    const authUser = ensureRequestUser(user);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const whereClause = buildMyParticipationsWhereClause(authUser.userId, query);

    const orderBy: Prisma.EventParticipantOrderByWithRelationInput =
        query.sortBy === "startsAt"
            ? {
                  event: {
                      startsAt: query.sortOrder,
                  },
              }
            : {
                  [query.sortBy]: query.sortOrder,
              };

    const [participations, total] = await Promise.all([
        prisma.eventParticipant.findMany({
            where: whereClause,
            select: participationRecordSelect,
            orderBy,
            skip,
            take: limit,
        }),
        prisma.eventParticipant.count({
            where: whereClause,
        }),
    ]);

    return {
        data: participations.map(formatParticipation),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const approveParticipant = async (
    user: IAuthUser | undefined,
    { id }: TParticipantIdParams,
    payload: TApproveParticipantPayload,
) => {
    const authUser = ensureRequestUser(user);

    const participant = await prisma.$transaction(async (tx) => {
        const existingParticipant = await getParticipantForModerationOrThrow(tx, id);

        ensureCanManageEvent(existingParticipant.event, authUser);
        ensureEventCanBeModerated(existingParticipant);

        if (existingParticipant.status === ParticipantStatus.APPROVED) {
            throw new AppError(
                status.CONFLICT,
                "This participant has already been approved.",
            );
        }

        if (existingParticipant.status === ParticipantStatus.BANNED) {
            throw new AppError(
                status.CONFLICT,
                "Banned participants cannot be approved.",
            );
        }

        if (existingParticipant.status !== ParticipantStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending participants can be approved.",
            );
        }

        if (
            existingParticipant.event.pricingType === EventPricingType.PAID &&
            existingParticipant.paymentStatus !== PaymentStatus.PAID
        ) {
            throw new AppError(
                status.BAD_REQUEST,
                "Paid participation cannot be approved before payment is completed.",
            );
        }

        await ensureEventHasCapacity(
            tx,
            existingParticipant.event.id,
            existingParticipant.event.capacity,
        );

        const now = new Date();

        return tx.eventParticipant.update({
            where: {
                id,
            },
            data: {
                status: ParticipantStatus.APPROVED,
                approvalNote: payload.approvalNote ?? null,
                rejectionReason: null,
                approvedById: authUser.userId,
                respondedAt: now,
                approvedAt: now,
                joinedAt: now,
                bannedAt: null,
            },
            select: participationRecordSelect,
        });
    });

    return formatParticipation(participant);
};

const rejectParticipant = async (
    user: IAuthUser | undefined,
    { id }: TParticipantIdParams,
    payload: TRejectParticipantPayload,
) => {
    const authUser = ensureRequestUser(user);

    const participant = await prisma.$transaction(async (tx) => {
        const existingParticipant = await getParticipantForModerationOrThrow(tx, id);

        ensureCanManageEvent(existingParticipant.event, authUser);
        ensureEventCanBeModerated(existingParticipant);

        if (existingParticipant.status !== ParticipantStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending participants can be rejected.",
            );
        }

        const now = new Date();

        return tx.eventParticipant.update({
            where: {
                id,
            },
            data: {
                status: ParticipantStatus.REJECTED,
                approvalNote: null,
                rejectionReason: payload.rejectionReason,
                approvedById: authUser.userId,
                respondedAt: now,
                approvedAt: null,
                joinedAt: null,
                bannedAt: null,
            },
            select: participationRecordSelect,
        });
    });

    return formatParticipation(participant);
};

const banParticipant = async (
    user: IAuthUser | undefined,
    { id }: TParticipantIdParams,
    payload: TBanParticipantPayload,
) => {
    const authUser = ensureRequestUser(user);

    const participant = await prisma.$transaction(async (tx) => {
        const existingParticipant = await getParticipantForModerationOrThrow(tx, id);

        ensureCanManageEvent(existingParticipant.event, authUser);
        ensureEventCanBeModerated(existingParticipant);

        if (existingParticipant.status === ParticipantStatus.BANNED) {
            throw new AppError(
                status.CONFLICT,
                "This participant has already been banned.",
            );
        }

        if (existingParticipant.status === ParticipantStatus.CANCELLED) {
            throw new AppError(
                status.CONFLICT,
                "Cancelled participation cannot be banned.",
            );
        }

        const now = new Date();

        return tx.eventParticipant.update({
            where: {
                id,
            },
            data: {
                status: ParticipantStatus.BANNED,
                approvedById: authUser.userId,
                rejectionReason:
                    payload.reason ?? existingParticipant.rejectionReason ?? null,
                respondedAt: existingParticipant.respondedAt ?? now,
                bannedAt: now,
                approvedAt:
                    existingParticipant.status === ParticipantStatus.APPROVED
                        ? existingParticipant.approvedAt
                        : null,
                joinedAt:
                    existingParticipant.status === ParticipantStatus.APPROVED
                        ? existingParticipant.joinedAt
                        : null,
            },
            select: participationRecordSelect,
        });
    });

    return formatParticipation(participant);
};

export const ParticipationServices = {
    joinEvent,
    listMyParticipations,
    approveParticipant,
    rejectParticipant,
    banParticipant,
};
