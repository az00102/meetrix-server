import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    EventLocationType,
    EventPricingType,
    EventStatus,
    EventVisibility,
} from "../../../generated/prisma/enums";
import { IQueryResult } from "../../interfaces/query.interface";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
    TEventSlugParams,
    TGetUpcomingEventsQuery,
    TListEventsQuery,
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

type EventCardRecord = Prisma.EventGetPayload<{
    select: typeof eventCardSelect;
}>;

type EventDetailRecord = Prisma.EventGetPayload<{
    select: typeof eventDetailSelect;
}>;

const toMoneyNumber = (value: Prisma.Decimal) => Number(value.toString());

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
        whereClause.locationType = query.locationType as EventLocationType;
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

export const EventServices = {
    listEvents,
    getFeaturedEvent,
    getUpcomingEvents,
    getEventBySlug,
};
