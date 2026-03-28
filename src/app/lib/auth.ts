import { betterAuth } from "better-auth";
import { envVars } from "../../config/env";
import { prisma } from "./prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { UserRole, UserStatus } from "../../generated/prisma/enums";

export const auth = betterAuth({

    basePath: envVars.BETTER_AUTH_URL,
    secret: envVars.BETTER_AUTH_SECRET,

    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: UserRole.USER
            },
            status: {
                type: "string",
                required: true,
                defaultValue: UserStatus.ACTIVE
            },
            phone: {
                type: "string",
                required: false,
            },
            bio: {
                type: "string",
                required: false,
            },
            isDeleted: {
                type: "boolean",
                required: true,
                defaultValue: false
            },
            deletedAt: {
                type: "date",
                required: false,
                defaultValue: null
            }
        },
    },
    
    emailAndPassword: {
        enabled: true,
    },

    session: {
        expiresIn: 60 * 60 * 60 * 24,
        updateAge: 60 * 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 60 * 24,
        }
    },

    advanced: {
        // disableCSRFCheck: true,
        useSecureCookies: false,
        cookies: {
            state: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                }
            },
            sessionToken: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                }
            }
        }
    }
});