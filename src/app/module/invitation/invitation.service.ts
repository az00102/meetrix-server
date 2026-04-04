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
    UserStatus,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IAuthUser } from "../../interfaces/interfaces";
import { IQueryResult } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import {
    TCreateInvitationPayload,
    TInvitationIdParams,
    TListMyInvitationsQuery,
    TListSentInvitationsQuery,
} from "./invitation.validation";

const invitationRecordSelect = {
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
            ownerId: true,
        },
    },
    invitedBy: {
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
        },
    },
    invitee: {
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
            isDeleted: true,
        },
    },
} as const;

const invitationActionSelect = {
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
            visibility: true,
            pricingType: true,
            capacity: true,
            status: true,
            isDeleted: true,
            ownerId: true,
            registrationFee: true,
            currency: true,
            startsAt: true,
        },
    },
} as const;

type InvitationRecord = Prisma.InvitationGetPayload<{
    select: typeof invitationRecordSelect;
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

const formatInvitation = (invitation: InvitationRecord) => ({
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
    event: {
        id: invitation.event.id,
        title: invitation.event.title,
        slug: invitation.event.slug,
        visibility: invitation.event.visibility,
        pricingType: invitation.event.pricingType,
        registrationFee: toMoneyNumber(invitation.event.registrationFee),
        currency: invitation.event.currency,
        startsAt: invitation.event.startsAt,
        ownerId: invitation.event.ownerId,
        ...getEventAccessPolicy(
            invitation.event.visibility,
            invitation.event.pricingType,
        ),
    },
    invitedBy: invitation.invitedBy,
    invitee: {
        id: invitation.invitee.id,
        name: invitation.invitee.name,
        email: invitation.invitee.email,
        image: invitation.invitee.image,
    },
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

const ensureInviteeIsEligible = (invitee: {
    status: UserStatus;
    isDeleted: boolean;
}) => {
    if (invitee.isDeleted || invitee.status === UserStatus.DELETED) {
        throw new AppError(
            status.BAD_REQUEST,
            "The selected user account is no longer available for invitations.",
        );
    }

    if (invitee.status !== UserStatus.ACTIVE) {
        throw new AppError(
            status.BAD_REQUEST,
            "Only active users can receive invitations.",
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

const buildSentInvitationsWhereClause = (
    user: IAuthUser,
    query: TListSentInvitationsQuery,
): Prisma.InvitationWhereInput => {
    const whereClause: Prisma.InvitationWhereInput = {
        event: {
            isDeleted: false,
            ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.userId }),
        },
    };

    if (query.status) {
        whereClause.status = query.status;
    }

    if (query.eventId) {
        whereClause.eventId = query.eventId;
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
                invitee: {
                    is: {
                        name: {
                            contains: query.searchTerm,
                            mode: "insensitive",
                        },
                    },
                },
            },
            {
                invitee: {
                    is: {
                        email: {
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

const createInvitation = async (
    user: IAuthUser | undefined,
    payload: TCreateInvitationPayload,
) => {
    const authUser = ensureRequestUser(user);

    const invitation = await prisma.$transaction(async (tx) => {
        const [event, invitee] = await Promise.all([
            tx.event.findUnique({
                where: {
                    id: payload.eventId,
                },
                select: {
                    id: true,
                    title: true,
                    ownerId: true,
                    isDeleted: true,
                    status: true,
                },
            }),
            tx.user.findUnique({
                where: {
                    email: payload.inviteeEmail,
                },
                select: {
                    id: true,
                    status: true,
                    isDeleted: true,
                },
            }),
        ]);

        if (!event || event.isDeleted) {
            throw new AppError(status.NOT_FOUND, "Event not found.");
        }

        ensureCanManageEvent(event, authUser);

        if (event.status !== EventStatus.PUBLISHED) {
            throw new AppError(
                status.BAD_REQUEST,
                "Only published events can send invitations.",
            );
        }

        if (!invitee) {
            throw new AppError(status.NOT_FOUND, "Invitee not found.");
        }

        ensureInviteeIsEligible(invitee);

        if (invitee.id === authUser.userId) {
            throw new AppError(
                status.BAD_REQUEST,
                "You cannot invite yourself to your own event.",
            );
        }

        const [existingParticipant, existingInvitation] = await Promise.all([
            tx.eventParticipant.findFirst({
                where: {
                    eventId: event.id,
                    userId: invitee.id,
                },
                select: {
                    status: true,
                },
            }),
            tx.invitation.findFirst({
                where: {
                    eventId: event.id,
                    inviteeId: invitee.id,
                },
                select: {
                    id: true,
                    status: true,
                },
            }),
        ]);

        if (existingParticipant?.status === ParticipantStatus.BANNED) {
            throw new AppError(
                status.FORBIDDEN,
                "This user is banned from the event and cannot be invited.",
            );
        }

        if (existingParticipant?.status === ParticipantStatus.APPROVED) {
            throw new AppError(
                status.CONFLICT,
                "This user is already participating in the event.",
            );
        }

        if (existingInvitation?.status === InvitationStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "There is already a pending invitation for this user.",
            );
        }

        const invitationData = {
            status: InvitationStatus.PENDING,
            paymentStatus: PaymentStatus.UNPAID,
            message: payload.message,
            expiresAt: payload.expiresAt,
            respondedAt: null,
            acceptedAt: null,
            declinedAt: null,
            invitedById: authUser.userId,
        };

        if (existingInvitation) {
            return tx.invitation.update({
                where: {
                    id: existingInvitation.id,
                },
                data: invitationData,
                select: invitationRecordSelect,
            });
        }

        return tx.invitation.create({
            data: {
                eventId: event.id,
                inviteeId: invitee.id,
                ...invitationData,
            },
            select: invitationRecordSelect,
        });
    });

    return formatInvitation(invitation);
};

const listMyInvitations = async (
    user: IAuthUser | undefined,
    query: TListMyInvitationsQuery,
): Promise<IQueryResult<ReturnType<typeof formatInvitation>>> => {
    const authUser = ensureRequestUser(user);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.InvitationWhereInput = {
        inviteeId: authUser.userId,
        event: {
            isDeleted: false,
        },
        status: query.status ?? InvitationStatus.PENDING,
    };

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
                invitedBy: {
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

    const [invitations, total] = await Promise.all([
        prisma.invitation.findMany({
            where: whereClause,
            select: invitationRecordSelect,
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
        prisma.invitation.count({
            where: whereClause,
        }),
    ]);

    return {
        data: invitations.map(formatInvitation),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const listSentInvitations = async (
    user: IAuthUser | undefined,
    query: TListSentInvitationsQuery,
): Promise<IQueryResult<ReturnType<typeof formatInvitation>>> => {
    const authUser = ensureRequestUser(user);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const whereClause = buildSentInvitationsWhereClause(authUser, query);

    const [invitations, total] = await Promise.all([
        prisma.invitation.findMany({
            where: whereClause,
            select: invitationRecordSelect,
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
        prisma.invitation.count({
            where: whereClause,
        }),
    ]);

    return {
        data: invitations.map(formatInvitation),
        meta: buildPaginationMeta(page, limit, total),
    };
};

const acceptInvitation = async (
    user: IAuthUser | undefined,
    { id }: TInvitationIdParams,
) => {
    const authUser = ensureRequestUser(user);

    return prisma.$transaction(async (tx) => {
        const invitation = await tx.invitation.findUnique({
            where: {
                id,
            },
            select: invitationActionSelect,
        });

        if (!invitation) {
            throw new AppError(status.NOT_FOUND, "Invitation not found.");
        }

        if (invitation.inviteeId !== authUser.userId) {
            throw new AppError(
                status.FORBIDDEN,
                "You do not have permission to respond to this invitation.",
            );
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending invitations can be accepted.",
            );
        }

        const now = new Date();

        if (invitation.expiresAt && invitation.expiresAt <= now) {
            await tx.invitation.update({
                where: {
                    id,
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
                "Only published events can accept invitations.",
            );
        }

        if (invitation.event.pricingType === EventPricingType.PAID) {
            throw new AppError(
                status.BAD_REQUEST,
                "Paid invitation acceptance requires payment integration and is not available yet.",
            );
        }

        const existingParticipant = await tx.eventParticipant.findFirst({
            where: {
                eventId: invitation.eventId,
                userId: authUser.userId,
            },
            select: {
                id: true,
                status: true,
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

        await ensureEventHasCapacity(
            tx,
            invitation.eventId,
            invitation.event.capacity,
        );

        const participantData = {
            joinType: ParticipationJoinType.INVITED,
            status: ParticipantStatus.APPROVED,
            paymentStatus: PaymentStatus.UNPAID,
            approvalNote: null,
            rejectionReason: null,
            approvedById: invitation.invitedById,
            respondedAt: now,
            approvedAt: now,
            joinedAt: now,
            bannedAt: null,
        };

        const participant = existingParticipant
            ? await tx.eventParticipant.update({
                  where: {
                      id: existingParticipant.id,
                  },
                  data: participantData,
                  select: {
                      id: true,
                      joinType: true,
                      status: true,
                      paymentStatus: true,
                  },
              })
            : await tx.eventParticipant.create({
                  data: {
                      eventId: invitation.eventId,
                      userId: authUser.userId,
                      ...participantData,
                  },
                  select: {
                      id: true,
                      joinType: true,
                      status: true,
                      paymentStatus: true,
                  },
              });

        const updatedInvitation = await tx.invitation.update({
            where: {
                id,
            },
            data: {
                status: InvitationStatus.ACCEPTED,
                respondedAt: now,
                acceptedAt: now,
                declinedAt: null,
            },
            select: invitationRecordSelect,
        });

        return {
            invitation: formatInvitation(updatedInvitation),
            participant,
        };
    });
};

const declineInvitation = async (
    user: IAuthUser | undefined,
    { id }: TInvitationIdParams,
) => {
    const authUser = ensureRequestUser(user);

    const invitation = await prisma.$transaction(async (tx) => {
        const existingInvitation = await tx.invitation.findUnique({
            where: {
                id,
            },
            select: invitationActionSelect,
        });

        if (!existingInvitation) {
            throw new AppError(status.NOT_FOUND, "Invitation not found.");
        }

        if (existingInvitation.inviteeId !== authUser.userId) {
            throw new AppError(
                status.FORBIDDEN,
                "You do not have permission to respond to this invitation.",
            );
        }

        if (existingInvitation.status !== InvitationStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending invitations can be declined.",
            );
        }

        const now = new Date();

        if (existingInvitation.expiresAt && existingInvitation.expiresAt <= now) {
            return tx.invitation.update({
                where: {
                    id,
                },
                data: {
                    status: InvitationStatus.EXPIRED,
                    respondedAt: now,
                },
                select: invitationRecordSelect,
            });
        }

        return tx.invitation.update({
            where: {
                id,
            },
            data: {
                status: InvitationStatus.DECLINED,
                respondedAt: now,
                declinedAt: now,
                acceptedAt: null,
            },
            select: invitationRecordSelect,
        });
    });

    return formatInvitation(invitation);
};

const cancelInvitation = async (
    user: IAuthUser | undefined,
    { id }: TInvitationIdParams,
) => {
    const authUser = ensureRequestUser(user);

    const invitation = await prisma.$transaction(async (tx) => {
        const existingInvitation = await tx.invitation.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                event: {
                    select: {
                        ownerId: true,
                        isDeleted: true,
                    },
                },
            },
        });

        if (!existingInvitation) {
            throw new AppError(status.NOT_FOUND, "Invitation not found.");
        }

        ensureCanManageEvent(existingInvitation.event, authUser);

        if (existingInvitation.status !== InvitationStatus.PENDING) {
            throw new AppError(
                status.CONFLICT,
                "Only pending invitations can be cancelled.",
            );
        }

        return tx.invitation.update({
            where: {
                id,
            },
            data: {
                status: InvitationStatus.CANCELLED,
                paymentStatus:
                    existingInvitation.paymentStatus === PaymentStatus.PAID
                        ? PaymentStatus.PAID
                        : PaymentStatus.CANCELLED,
                respondedAt: new Date(),
                acceptedAt: null,
                declinedAt: null,
            },
            select: invitationRecordSelect,
        });
    });

    return formatInvitation(invitation);
};

export const InvitationServices = {
    createInvitation,
    listMyInvitations,
    listSentInvitations,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
};
