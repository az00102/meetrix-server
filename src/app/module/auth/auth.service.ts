import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import status from "http-status";
import { envVars } from "../../../config/env";
import {
    ILoginPayload,
    IUserRegistrationPayload,
} from "./auth.inteface";
import AppError from "../../errorHelpers/AppError";
import { tokenUtils } from "../../utils/token";
import { jwtUtils } from "../../utils/jwt";
import { JWTPayload } from "better-auth";
import { Prisma } from "../../../generated/prisma/client";
import { ICurrentUserProfile } from "../../interfaces/interfaces";
import { TUpdateMePayload } from "./auth.validation";

const userProfileSelect = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    createdAt: true,
    updatedAt: true,
    role: true,
    status: true,
    phone: true,
    bio: true,
    isDeleted: true,
} as const;

const buildTokenPayload = (user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    isDeleted: boolean;
    emailVerified: boolean;
}) => ({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    isDeleted: user.isDeleted,
    emailVerified: user.emailVerified,
});

const formatUserProfile = (user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: string;
    status: string;
    phone: string | null;
    bio: string | null;
    isDeleted: boolean;
}) => {
    const { isDeleted, ...profile } = user;

    return profile;
};

const ensureUserCanAccessAccount = (user: {
    status: string;
    isDeleted: boolean;
}) => {
    if (user.status === "SUSPENDED") {
        throw new AppError(
            status.FORBIDDEN,
            "Your account is suspended. Please contact support.",
        );
    }

    if (user.status === "INACTIVE") {
        throw new AppError(
            status.FORBIDDEN,
            "Your account is inactive. Please contact support.",
        );
    }

    if (user.isDeleted || user.status === "DELETED") {
        throw new AppError(status.GONE, "Your account is deleted.");
    }
};

const registerUser = async (payload: IUserRegistrationPayload) => {
    const data = await auth.api.signUpEmail({
        body: {
            email: payload.email,
            password: payload.password,
            name: payload.name
        }
    })

    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to register user");
    }

    const tokenPayload = buildTokenPayload(data.user);

    const accessToken = tokenUtils.getAccessToken(tokenPayload)

    const refreshToken = tokenUtils.getRefreshToken(tokenPayload)

    return {
        accessToken,
        refreshToken,
        ...data,
    }
}

const loginUser = async (payload: ILoginPayload) => {
    const data = await auth.api.signInEmail({
        body: {
            email: payload.email,
            password: payload.password
        }
    })

    ensureUserCanAccessAccount(data.user);

    const tokenPayload = buildTokenPayload(data.user);

    const accessToken = tokenUtils.getAccessToken(tokenPayload)

    const refreshToken = tokenUtils.getRefreshToken(tokenPayload)

    return {
        accessToken,
        refreshToken,
        ...data,
    }
}

const getNewToken = async (refreshToken: string, sessionToken: string) => {
    const isSessionTokenExist = await prisma.session.findUnique({
        where: {
            token: sessionToken
        },
        include: {
            user: true
        }
    });

    if (!isSessionTokenExist) {
        throw new AppError(status.UNAUTHORIZED, "Invalid Session Token!");
    }

    const verifiedRefreshToken = jwtUtils.verifyToken(refreshToken, envVars.REFRESH_TOKEN_SECRET)

    if (!verifiedRefreshToken.success && verifiedRefreshToken.error) {
        throw new AppError(status.UNAUTHORIZED, "Invalid Refresh Token!");
    }

    const data = verifiedRefreshToken.data as JWTPayload;

    if (data.userId !== isSessionTokenExist.userId) {
        throw new AppError(
            status.UNAUTHORIZED,
            "Refresh token does not match the active session.",
        );
    }

    ensureUserCanAccessAccount(isSessionTokenExist.user);

    const tokenPayload = buildTokenPayload(isSessionTokenExist.user);

    const newAccessToken = tokenUtils.getAccessToken(tokenPayload);

    const newRefreshToken = tokenUtils.getRefreshToken(tokenPayload);

    const { token } = await prisma.session.update({
        where: {
            token: sessionToken
        },
        data: {
            token: sessionToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 60 * 24 * 1000),
            updatedAt: new Date(),
        }
    });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionToken: token
    }
}

const logoutUser = async (sessionToken: string) => {
    if (!sessionToken) {
        throw new AppError(status.UNAUTHORIZED, "Session token is missing.");
    }

    const result = await auth.api.signOut({
        headers: {
            Authorization: `Bearer ${sessionToken}`
        }
    })

    return result;
}

const getMe = async (currentUser: ICurrentUserProfile) => {
    return formatUserProfile(currentUser);
}

const updateMe = async (
    currentUser: ICurrentUserProfile,
    payload: TUpdateMePayload,
) => {
    ensureUserCanAccessAccount(currentUser);

    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: currentUser.id,
            },
            data: payload,
            select: userProfileSelect,
        });

        const tokenPayload = buildTokenPayload(updatedUser);
        const accessToken = tokenUtils.getAccessToken(tokenPayload);
        const refreshToken = tokenUtils.getRefreshToken(tokenPayload);

        return {
            user: formatUserProfile(updatedUser),
            accessToken,
            refreshToken,
        };
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025"
        ) {
            throw new AppError(status.NOT_FOUND, "User Not Found!");
        }

        throw error;
    }
}


export const AuthServices = {
    registerUser,
    loginUser,
    getNewToken,
    logoutUser,
    getMe,
    updateMe,
}
