import { z } from "zod";
import { InvitationStatus } from "../../../generated/prisma/enums";

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

const normalizeOptionalString = (max: number, tooLongMessage: string) =>
    z.preprocess((value) => {
        if (typeof value !== "string") {
            return value;
        }

        const trimmedValue = value.trim();

        return trimmedValue === "" ? undefined : trimmedValue;
    }, z.string().trim().max(max, tooLongMessage).optional());

const dateTimeSchema = z.preprocess((value) => {
    if (value === undefined) {
        return undefined;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? undefined : new Date(trimmedValue);
}, z.date().optional());

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

const invitationIdParamsSchema = z.object({
    params: z
        .object({
            id: createTrimmedStringSchema(
                1,
                100,
                "Invitation id is required.",
                "Invitation id is too long.",
            ),
        })
        .strict(),
});

const eventIdSchema = createTrimmedStringSchema(
    1,
    100,
    "Event id is required.",
    "Event id is too long.",
);

const createInvitationValidationSchema = z.object({
    body: z
        .object({
            eventId: createTrimmedStringSchema(
                1,
                100,
                "Event id is required.",
                "Event id is too long.",
            ),
            inviteeEmail: z
                .string()
                .trim()
                .email("A valid invitee email is required."),
            message: normalizeOptionalString(
                1000,
                "Invitation message cannot exceed 1000 characters.",
            ),
            expiresAt: dateTimeSchema,
        })
        .strict(),
});

const listMyInvitationsQuerySchema = z.object({
    query: z
        .object({
            page: pageSchema,
            limit: limitSchema,
            status: z.nativeEnum(InvitationStatus).optional(),
            searchTerm: normalizeOptionalString(
                100,
                "Search term cannot exceed 100 characters.",
            ),
        })
        .strict(),
});

const listSentInvitationsQuerySchema = z.object({
    query: z
        .object({
            page: pageSchema,
            limit: limitSchema,
            status: z.nativeEnum(InvitationStatus).optional(),
            eventId: z.preprocess((value) => {
                if (typeof value !== "string") {
                    return value;
                }

                const trimmedValue = value.trim();

                return trimmedValue === "" ? undefined : trimmedValue;
            }, eventIdSchema.optional()),
            searchTerm: normalizeOptionalString(
                100,
                "Search term cannot exceed 100 characters.",
            ),
        })
        .strict(),
});

const respondToInvitationValidationSchema = z.object({
    params: invitationIdParamsSchema.shape.params,
});

const cancelInvitationValidationSchema = z.object({
    params: invitationIdParamsSchema.shape.params,
});

export type TInvitationIdParams = z.infer<
    typeof invitationIdParamsSchema.shape.params
>;
export type TCreateInvitationPayload = z.infer<
    typeof createInvitationValidationSchema.shape.body
>;
export type TListMyInvitationsQuery = z.infer<
    typeof listMyInvitationsQuerySchema.shape.query
>;
export type TListSentInvitationsQuery = z.infer<
    typeof listSentInvitationsQuerySchema.shape.query
>;

export const InvitationValidations = {
    createInvitationValidationSchema,
    listMyInvitationsQuerySchema,
    listSentInvitationsQuerySchema,
    respondToInvitationValidationSchema,
    cancelInvitationValidationSchema,
};
