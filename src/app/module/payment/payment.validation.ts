import { z } from "zod";
import {
    PaymentPurpose,
    PaymentStatus,
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

const paymentIdParamsSchema = z.object({
    params: z
        .object({
            id: createTrimmedStringSchema(
                1,
                100,
                "Payment id is required.",
                "Payment id is too long.",
            ),
        })
        .strict(),
});

const initiatePaymentValidationSchema = z.object({
    body: z
        .object({
            purpose: z.nativeEnum(PaymentPurpose),
            eventId: normalizeOptionalString(100, "Event id is too long."),
            invitationId: normalizeOptionalString(
                100,
                "Invitation id is too long.",
            ),
        })
        .strict()
        .superRefine((data, ctx) => {
            if (
                data.purpose === PaymentPurpose.EVENT_REGISTRATION &&
                !data.eventId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["eventId"],
                    message:
                        "Event id is required for event registration payments.",
                });
            }

            if (
                data.purpose === PaymentPurpose.EVENT_REGISTRATION &&
                data.invitationId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["invitationId"],
                    message:
                        "Invitation id is not allowed for event registration payments.",
                });
            }

            if (
                data.purpose === PaymentPurpose.INVITATION_ACCEPTANCE &&
                !data.invitationId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["invitationId"],
                    message:
                        "Invitation id is required for invitation acceptance payments.",
                });
            }

            if (
                data.purpose === PaymentPurpose.INVITATION_ACCEPTANCE &&
                data.eventId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["eventId"],
                    message:
                        "Event id is not allowed for invitation acceptance payments.",
                });
            }
        }),
});

const listMyPaymentsQuerySchema = z.object({
    query: z
        .object({
            page: pageSchema,
            limit: limitSchema,
            status: z.nativeEnum(PaymentStatus).optional(),
            purpose: z.nativeEnum(PaymentPurpose).optional(),
            searchTerm: normalizeOptionalString(
                100,
                "Search term cannot exceed 100 characters.",
            ),
            sortBy: z
                .enum(["createdAt", "updatedAt", "paidAt", "amount"])
                .default("createdAt"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
        })
        .strict(),
});

const sslCommerzCallbackParamsSchema = z.object({
    params: z
        .object({
            outcome: z.enum(["success", "fail", "cancel"]),
        })
        .strict(),
});

const sslCommerzCallbackPayloadSchema = z
    .object({
        status: normalizeOptionalString(50, "Status is too long."),
        tran_id: normalizeOptionalString(100, "Transaction id is too long."),
        val_id: normalizeOptionalString(100, "Validation id is too long."),
        amount: normalizeOptionalString(50, "Amount is too long."),
        currency: normalizeOptionalString(20, "Currency is too long."),
        bank_tran_id: normalizeOptionalString(
            100,
            "Bank transaction id is too long.",
        ),
        card_type: normalizeOptionalString(100, "Card type is too long."),
        store_amount: normalizeOptionalString(
            50,
            "Store amount is too long.",
        ),
        risk_level: normalizeOptionalString(20, "Risk level is too long."),
        risk_title: normalizeOptionalString(100, "Risk title is too long."),
        value_a: normalizeOptionalString(255, "Value A is too long."),
        value_b: normalizeOptionalString(255, "Value B is too long."),
        value_c: normalizeOptionalString(255, "Value C is too long."),
        value_d: normalizeOptionalString(255, "Value D is too long."),
    })
    .passthrough();

export type TPaymentIdParams = z.infer<typeof paymentIdParamsSchema.shape.params>;
export type TInitiatePaymentPayload = z.infer<
    typeof initiatePaymentValidationSchema.shape.body
>;
export type TListMyPaymentsQuery = z.infer<
    typeof listMyPaymentsQuerySchema.shape.query
>;
export type TSslCommerzCallbackParams = z.infer<
    typeof sslCommerzCallbackParamsSchema.shape.params
>;
export type TSslCommerzCallbackPayload = z.infer<
    typeof sslCommerzCallbackPayloadSchema
>;

export const PaymentValidations = {
    paymentIdParamsSchema,
    initiatePaymentValidationSchema,
    listMyPaymentsQuerySchema,
    sslCommerzCallbackParamsSchema,
    sslCommerzCallbackPayloadSchema,
};
