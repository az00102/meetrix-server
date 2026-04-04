import { z } from "zod";
import {
    ParticipantStatus,
    ParticipationJoinType,
} from "../../../generated/prisma/enums";

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

const eventIdParamsSchema = z.object({
    params: z
        .object({
            eventId: createTrimmedStringSchema(
                1,
                100,
                "Event id is required.",
                "Event id is too long.",
            ),
        })
        .strict(),
});

const participantIdParamsSchema = z.object({
    params: z
        .object({
            id: createTrimmedStringSchema(
                1,
                100,
                "Participant id is required.",
                "Participant id is too long.",
            ),
        })
        .strict(),
});

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

const joinEventValidationSchema = z.object({
    params: eventIdParamsSchema.shape.params,
});

const approveParticipantValidationSchema = z.object({
    params: participantIdParamsSchema.shape.params,
    body: z
        .object({
            approvalNote: normalizeOptionalString(
                500,
                "Approval note cannot exceed 500 characters.",
            ),
        })
        .strict(),
});

const rejectParticipantValidationSchema = z.object({
    params: participantIdParamsSchema.shape.params,
    body: z
        .object({
            rejectionReason: createTrimmedStringSchema(
                1,
                500,
                "Rejection reason is required.",
                "Rejection reason cannot exceed 500 characters.",
            ),
        })
        .strict(),
});

const banParticipantValidationSchema = z.object({
    params: participantIdParamsSchema.shape.params,
    body: z
        .object({
            reason: normalizeOptionalString(
                500,
                "Ban reason cannot exceed 500 characters.",
            ),
        })
        .strict(),
});

const listMyParticipationsQuerySchema = z.object({
    query: z
        .object({
            page: pageSchema,
            limit: limitSchema,
            status: z.nativeEnum(ParticipantStatus).optional(),
            joinType: z.nativeEnum(ParticipationJoinType).optional(),
            searchTerm: normalizeOptionalString(
                100,
                "Search term cannot exceed 100 characters.",
            ),
            sortBy: z
                .enum(["createdAt", "updatedAt", "joinedAt", "startsAt"])
                .default("updatedAt"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
        })
        .strict(),
});

export type TEventIdParams = z.infer<typeof eventIdParamsSchema.shape.params>;
export type TParticipantIdParams = z.infer<
    typeof participantIdParamsSchema.shape.params
>;
export type TApproveParticipantPayload = z.infer<
    typeof approveParticipantValidationSchema.shape.body
>;
export type TRejectParticipantPayload = z.infer<
    typeof rejectParticipantValidationSchema.shape.body
>;
export type TBanParticipantPayload = z.infer<
    typeof banParticipantValidationSchema.shape.body
>;
export type TListMyParticipationsQuery = z.infer<
    typeof listMyParticipationsQuerySchema.shape.query
>;

export const ParticipationValidations = {
    joinEventValidationSchema,
    approveParticipantValidationSchema,
    rejectParticipantValidationSchema,
    banParticipantValidationSchema,
    listMyParticipationsQuerySchema,
};
