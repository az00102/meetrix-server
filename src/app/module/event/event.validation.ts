import { z } from "zod";
import {
    EventLocationType,
    EventPricingType,
    EventStatus,
    EventVisibility,
    ParticipantStatus,
} from "../../../generated/prisma/enums";

const normalizeOptionalString = () =>
    z.preprocess((value) => {
        if (typeof value !== "string") {
            return value;
        }

        const trimmedValue = value.trim();

        return trimmedValue === "" ? undefined : trimmedValue;
    }, z.string().optional());

const createTrimmedStringSchema = (
    min: number,
    max: number,
    requiredMessage: string,
    tooLongMessage: string,
) =>
    z
        .string()
        .trim()
        .min(min, requiredMessage)
        .max(max, tooLongMessage);

const createNullableOptionalStringSchema = (max: number, tooLongMessage: string) =>
    z.preprocess((value) => {
        if (value === null) {
            return null;
        }

        if (typeof value !== "string") {
            return value;
        }

        const trimmedValue = value.trim();

        return trimmedValue === "" ? null : trimmedValue;
    }, z.string().trim().max(max, tooLongMessage).nullable().optional());

const dateTimeSchema = z.preprocess((value) => {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? value : new Date(trimmedValue);
}, z.date());

const optionalNullableDateTimeSchema = z.preprocess((value) => {
    if (value === null) {
        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? null : new Date(trimmedValue);
}, z.date().nullable().optional());

const nonNegativeNumberSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        const trimmedValue = value.trim();

        return trimmedValue === "" ? value : Number(trimmedValue);
    }

    return value;
}, z.number().finite().min(0));

const optionalNullableIntegerSchema = z.preprocess((value) => {
    if (value === null) {
        return null;
    }

    if (typeof value === "string") {
        const trimmedValue = value.trim();

        return trimmedValue === "" ? null : Number(trimmedValue);
    }

    return value;
}, z.number().int().min(1).nullable().optional());

const optionalNullableUrlSchema = z.preprocess((value) => {
    if (value === null) {
        return null;
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? null : trimmedValue;
}, z.string().url("Invalid URL format.").nullable().optional());

const timezoneSchema = z.preprocess((value) => {
    if (value === undefined) {
        return "UTC";
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? "UTC" : trimmedValue;
}, z.string().min(1, "Timezone is required.").max(100, "Timezone is too long."));

const optionalTimezoneSchema = z.preprocess((value) => {
    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? undefined : trimmedValue;
}, z.string().min(1, "Timezone is required.").max(100, "Timezone is too long.").optional());

const currencySchema = z.preprocess((value) => {
    if (value === undefined) {
        return "BDT";
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim().toUpperCase();

    return trimmedValue === "" ? "BDT" : trimmedValue;
}, z.string().length(3, "Currency must be a 3-letter ISO code."));

const optionalCurrencySchema = z.preprocess((value) => {
    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim().toUpperCase();

    return trimmedValue === "" ? undefined : trimmedValue;
}, z.string().length(3, "Currency must be a 3-letter ISO code.").optional());

const pageSchema = z.preprocess((value) => {
    if (value === undefined) {
        return 1;
    }

    return Number(value);
}, z.number().int().min(1));

const limitSchema = z.preprocess((value) => {
    if (value === undefined) {
        return 10;
    }

    return Number(value);
}, z.number().int().min(1).max(50));

const listEventsQuerySchema = z.object({
    query: z
        .object({
            searchTerm: normalizeOptionalString(),
            page: pageSchema,
            limit: limitSchema,
            sortBy: z
                .enum(["startsAt", "createdAt", "updatedAt", "title"])
                .default("startsAt"),
            sortOrder: z.enum(["asc", "desc"]).default("asc"),
            pricingType: z.nativeEnum(EventPricingType).optional(),
            locationType: z.nativeEnum(EventLocationType).optional(),
        })
        .strict(),
});

const getUpcomingEventsQuerySchema = z.object({
    query: z
        .object({
            limit: z.preprocess((value) => {
                if (value === undefined) {
                    return 9;
                }

                return Number(value);
            }, z.number().int().min(1).max(20)),
        })
        .strict(),
});

const eventSlugParamsSchema = z.object({
    params: z
        .object({
            slug: createTrimmedStringSchema(
                1,
                200,
                "Event slug is required.",
                "Event slug is too long.",
            ),
        })
        .strict(),
});

const eventIdParamsSchema = z.object({
    params: z
        .object({
            id: createTrimmedStringSchema(
                1,
                100,
                "Event id is required.",
                "Event id is too long.",
            ),
        })
        .strict(),
});

const createEventBodySchema = z
    .object({
        title: createTrimmedStringSchema(
            1,
            200,
            "Event title is required.",
            "Event title is too long.",
        ),
        summary: createNullableOptionalStringSchema(
            300,
            "Summary cannot exceed 300 characters.",
        ),
        description: createTrimmedStringSchema(
            1,
            5000,
            "Event description is required.",
            "Event description is too long.",
        ),
        startsAt: dateTimeSchema,
        endsAt: optionalNullableDateTimeSchema,
        timezone: timezoneSchema,
        locationType: z.nativeEnum(EventLocationType),
        venue: createNullableOptionalStringSchema(
            300,
            "Venue cannot exceed 300 characters.",
        ),
        eventLink: optionalNullableUrlSchema,
        visibility: z.nativeEnum(EventVisibility),
        pricingType: z.nativeEnum(EventPricingType),
        registrationFee: nonNegativeNumberSchema.default(0),
        currency: currencySchema,
        capacity: optionalNullableIntegerSchema,
        bannerImage: optionalNullableUrlSchema,
        status: z
            .enum([EventStatus.DRAFT, EventStatus.PUBLISHED])
            .default(EventStatus.DRAFT),
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.endsAt && data.endsAt <= data.startsAt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endsAt"],
                message: "Event end time must be after the start time.",
            });
        }

        if (
            data.locationType === EventLocationType.OFFLINE &&
            (!data.venue || data.venue.trim().length === 0)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["venue"],
                message: "Venue is required for offline events.",
            });
        }

        if (
            data.locationType === EventLocationType.ONLINE &&
            (!data.eventLink || data.eventLink.trim().length === 0)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["eventLink"],
                message: "Event link is required for online events.",
            });
        }

        if (
            data.pricingType === EventPricingType.PAID &&
            data.registrationFee <= 0
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["registrationFee"],
                message: "Paid events must have a registration fee greater than 0.",
            });
        }
    });

const createEventValidationSchema = z.object({
    body: createEventBodySchema,
});

const updateEventBodySchema = z
    .object({
        title: createTrimmedStringSchema(
            1,
            200,
            "Event title is required.",
            "Event title is too long.",
        ).optional(),
        summary: createNullableOptionalStringSchema(
            300,
            "Summary cannot exceed 300 characters.",
        ),
        description: createTrimmedStringSchema(
            1,
            5000,
            "Event description is required.",
            "Event description is too long.",
        ).optional(),
        startsAt: dateTimeSchema.optional(),
        endsAt: optionalNullableDateTimeSchema,
        timezone: optionalTimezoneSchema,
        locationType: z.nativeEnum(EventLocationType).optional(),
        venue: createNullableOptionalStringSchema(
            300,
            "Venue cannot exceed 300 characters.",
        ),
        eventLink: optionalNullableUrlSchema,
        visibility: z.nativeEnum(EventVisibility).optional(),
        pricingType: z.nativeEnum(EventPricingType).optional(),
        registrationFee: nonNegativeNumberSchema.optional(),
        currency: optionalCurrencySchema,
        capacity: optionalNullableIntegerSchema,
        bannerImage: optionalNullableUrlSchema,
        status: z
            .enum([
                EventStatus.DRAFT,
                EventStatus.PUBLISHED,
                EventStatus.CANCELLED,
            ])
            .optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required to update an event.",
    });

const updateEventValidationSchema = z.object({
    params: eventIdParamsSchema.shape.params,
    body: updateEventBodySchema,
});

const listMyEventsQuerySchema = z.object({
    query: z
        .object({
            searchTerm: normalizeOptionalString(),
            page: pageSchema,
            limit: limitSchema,
            sortBy: z
                .enum(["startsAt", "createdAt", "updatedAt", "title"])
                .default("updatedAt"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
            status: z.nativeEnum(EventStatus).optional(),
            visibility: z.nativeEnum(EventVisibility).optional(),
            pricingType: z.nativeEnum(EventPricingType).optional(),
            locationType: z.nativeEnum(EventLocationType).optional(),
        })
        .strict(),
});

const listEventParticipantsQuerySchema = z.object({
    query: z
        .object({
            searchTerm: normalizeOptionalString(),
            page: pageSchema,
            limit: limitSchema,
            status: z.nativeEnum(ParticipantStatus).optional(),
        })
        .strict(),
});

const listEventParticipantsValidationSchema = z.object({
    params: eventIdParamsSchema.shape.params,
    query: listEventParticipantsQuerySchema.shape.query,
});

export type TListEventsQuery = z.infer<typeof listEventsQuerySchema.shape.query>;
export type TGetUpcomingEventsQuery = z.infer<
    typeof getUpcomingEventsQuerySchema.shape.query
>;
export type TEventSlugParams = z.infer<typeof eventSlugParamsSchema.shape.params>;
export type TEventIdParams = z.infer<typeof eventIdParamsSchema.shape.params>;
export type TCreateEventPayload = z.infer<typeof createEventBodySchema>;
export type TUpdateEventPayload = z.infer<typeof updateEventBodySchema>;
export type TListMyEventsQuery = z.infer<typeof listMyEventsQuerySchema.shape.query>;
export type TListEventParticipantsQuery = z.infer<
    typeof listEventParticipantsQuerySchema.shape.query
>;

export const EventValidations = {
    listEventsQuerySchema,
    getUpcomingEventsQuerySchema,
    eventSlugParamsSchema,
    eventIdParamsSchema,
    createEventValidationSchema,
    updateEventValidationSchema,
    listMyEventsQuerySchema,
    listEventParticipantsValidationSchema,
};
