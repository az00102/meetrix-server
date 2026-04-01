import { betterAuth } from "better-auth";
import { envVars } from "../../config/env";
import { prisma } from "./prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { UserRole, UserStatus } from "../../generated/prisma/enums";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 60;
export const SESSION_EXPIRES_IN_MS = SESSION_EXPIRES_IN_SECONDS * 1000;

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

    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:5000", envVars.FRONTEND_URL],

    session: {
        expiresIn: SESSION_EXPIRES_IN_SECONDS,
        updateAge: SESSION_EXPIRES_IN_SECONDS,
        cookieCache: {
            enabled: true,
            maxAge: SESSION_EXPIRES_IN_SECONDS,
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
