import { z } from "zod";
import {
    EventLocationType,
    EventPricingType,
} from "../../../generated/prisma/enums";

const normalizeOptionalString = () =>
    z.preprocess((value) => {
        if (typeof value !== "string") {
            return value;
        }

        const trimmedValue = value.trim();

        return trimmedValue === "" ? undefined : trimmedValue;
    }, z.string().optional());

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
            slug: z
                .string()
                .trim()
                .min(1, "Event slug is required.")
                .max(200, "Event slug is too long."),
        })
        .strict(),
});

export type TListEventsQuery = z.infer<typeof listEventsQuerySchema.shape.query>;
export type TGetUpcomingEventsQuery = z.infer<
    typeof getUpcomingEventsQuerySchema.shape.query
>;
export type TEventSlugParams = z.infer<typeof eventSlugParamsSchema.shape.params>;

export const EventValidations = {
    listEventsQuerySchema,
    getUpcomingEventsQuerySchema,
    eventSlugParamsSchema,
};
