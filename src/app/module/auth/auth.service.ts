import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import status from "http-status";
import { envVars } from "../../../config/env";
import { ILoginPayload, IUserRegistrationPayload } from "./auth.inteface";
import AppError from "../../errorHelpers/AppError";
import { tokenUtils } from "../../utils/token";
import { jwtUtils } from "../../utils/jwt";
import { JWTPayload } from "better-auth";


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

    const accessToken = tokenUtils.getAccessToken({
        userId: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified
    })

    const refreshToken = tokenUtils.getRefreshToken({
        userId: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified
    })

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

    if (data.user.status === "SUSPENDED") {
        throw new AppError(status.FORBIDDEN, "Your account is suspended. Please contact support.");
    }

    if (data.user.isDeleted || data.user.status === "DELETED") {
        throw new AppError(status.GONE, "Your account is deleted.");
    }

    const accessToken = tokenUtils.getAccessToken({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified
    })

    const refreshToken = tokenUtils.getRefreshToken({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified
    })

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

    const newAccessToken = tokenUtils.getAccessToken({
        userId: data.userId,
        role: data.role,
        name: data.name,
        email: data.email,
        status: data.status,
        isDeleted: data.isDeleted,
        emailVerified: data.emailVerified,
    });

    const newRefreshToken = tokenUtils.getRefreshToken({
        userId: data.userId,
        role: data.role,
        name: data.name,
        email: data.email,
        status: data.status,
        isDeleted: data.isDeleted,
        emailVerified: data.emailVerified,
    });

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
    const result = await auth.api.signOut({
        headers: {
            Authorization: `Bearer ${sessionToken}`
        }
    })

    return result;
}

export const AuthServices = {
    registerUser,
    loginUser,
    getNewToken,
    logoutUser,
}