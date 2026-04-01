import { z } from "zod";

const nullableTrimmedString = (fieldName: string, maxLength: number) =>
    z.preprocess(
        (value) => {
            if (value === undefined || value === null) {
                return value;
            }

            if (typeof value === "string") {
                const trimmedValue = value.trim();

                return trimmedValue === "" ? null : trimmedValue;
            }

            return value;
        },
        z
            .union([
                z
                    .string()
                    .max(
                        maxLength,
                        `${fieldName} cannot be longer than ${maxLength} characters.`,
                    ),
                z.null(),
            ])
            .optional(),
    );

const registerUserValidationSchema = z.object({
    body: z
        .object({
            name: z
                .string()
                .trim()
                .min(1, "Name is required.")
                .max(100, "Name cannot be longer than 100 characters."),
            email: z.string().trim().email("Please provide a valid email address."),
            password: z
                .string()
                .min(6, "Password must be at least 6 characters long."),
        })
        .strict(),
});

const loginUserValidationSchema = z.object({
    body: z
        .object({
            email: z.string().trim().email("Please provide a valid email address."),
            password: z.string().min(1, "Password is required."),
        })
        .strict(),
});

const updateMeBodySchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Name cannot be empty.")
            .max(100, "Name cannot be longer than 100 characters.")
            .optional(),
        phone: nullableTrimmedString("Phone", 30),
        bio: nullableTrimmedString("Bio", 500),
        image: z.preprocess(
            (value) => {
                if (value === undefined || value === null) {
                    return value;
                }

                if (typeof value === "string") {
                    const trimmedValue = value.trim();

                    return trimmedValue === "" ? null : trimmedValue;
                }

                return value;
            },
            z
                .union([
                    z
                        .string()
                        .url("Image must be a valid URL.")
                        .max(2048, "Image cannot be longer than 2048 characters."),
                    z.null(),
                ])
                .optional(),
        ),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one profile field is required to update your profile.",
    });

const updateMeValidationSchema = z.object({
    body: updateMeBodySchema,
});

export type TRegisterUserPayload = z.infer<
    typeof registerUserValidationSchema.shape.body
>;
export type TLoginUserPayload = z.infer<typeof loginUserValidationSchema.shape.body>;
export type TUpdateMePayload = z.infer<typeof updateMeBodySchema>;

export const AuthValidations = {
    registerUserValidationSchema,
    loginUserValidationSchema,
    updateMeValidationSchema,
};
