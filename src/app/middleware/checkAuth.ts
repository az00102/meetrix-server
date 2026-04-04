import { NextFunction, Request, RequestHandler, Response } from "express";
import { UserRole, UserStatus } from "../../generated/prisma/enums";
import { cookieUtils } from "../utils/cookie";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import status from "http-status";
import { jwtUtils } from "../utils/jwt";
import { envVars } from "../../config/env";

const getUserAccessError = (user: {
    status: UserStatus;
    isDeleted: boolean;
}) => {
    if (user.isDeleted || user.status === UserStatus.DELETED) {
        return new AppError(status.GONE, "Your account has been deleted.");
    }

    if (user.status === UserStatus.SUSPENDED) {
        return new AppError(
            status.FORBIDDEN,
            "Your account is suspended. Please contact support.",
        );
    }

    if (user.status === UserStatus.INACTIVE) {
        return new AppError(
            status.FORBIDDEN,
            "Your account is inactive. Please contact support.",
        );
    }

    return null;
};

const checkAuth = <
    TParams extends Request["params"] = Request["params"],
    TResponseBody = unknown,
    TRequestBody = unknown,
    TRequestQuery = Request["query"],
    TLocals extends Record<string, unknown> = Record<string, unknown>,
>(
    ...authRoles: UserRole[]
): RequestHandler<
    TParams,
    TResponseBody,
    TRequestBody,
    TRequestQuery,
    TLocals
> => async (
    req: Request<TParams, TResponseBody, TRequestBody, TRequestQuery, TLocals>,
    res: Response<TResponseBody, TLocals>,
    next: NextFunction,
) => {
    try {
        const sessionToken = cookieUtils.getCookie(req, 'better-auth.session_token');
        const accessToken = cookieUtils.getCookie(req, 'accessToken');

        //betterauth session token verification
        if (!sessionToken) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! No session token provided.');
        }

        if (!accessToken) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! No access token provided.');
        }

        const sessionExist = await prisma.session.findUnique({
            where: {
                token: sessionToken,
            },
            include: {
                user: true
            }
        });

        if (!sessionExist || !sessionExist.user || sessionExist.expiresAt <= new Date()) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! Invalid or expired session.');
        }

        const verifiedToken = jwtUtils.verifyToken(accessToken, envVars.ACCESS_TOKEN_SECRET);

        if (!verifiedToken.success || !verifiedToken.data) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! Invalid access token.');
        }

        const user = sessionExist.user;
        const tokenPayload = verifiedToken.data;

        if (tokenPayload.userId !== user.id || tokenPayload.role !== user.role) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! Session and access token do not match.');
        }

        const createdAt = sessionExist.createdAt;
        const expiresAt = sessionExist.expiresAt;
        const now = new Date();

        const userAccessError = getUserAccessError(user);

        if (userAccessError) {
            throw userAccessError;
        }

        if (authRoles.length > 0 && !authRoles.includes(user.role)) {
            throw new AppError(status.FORBIDDEN, `Forbidden access! You do not have permission to access this resource. \nRequired role: ${authRoles.join(', ')}\nYour role: ${user.role}`);
        }

        const sessionLifespan = expiresAt.getTime() - createdAt.getTime();
        const timeRemaining = expiresAt.getTime() - now.getTime();
        const percentageRemaining =
            sessionLifespan > 0 ? (timeRemaining / sessionLifespan) * 100 : 100;

        if (percentageRemaining < 20) {
            res.setHeader('X-Session-Refresh', 'true');
            res.setHeader('X-Session-Expires-At', expiresAt.toISOString());
            res.setHeader('X-Time-Remaining', timeRemaining.toString());
        }

        req.user = {
            userId: user.id,
            role: user.role,
            email: user.email,
            name: user.name
        };

        req.currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: user.role,
            status: user.status,
            phone: user.phone,
            bio: user.bio,
            isDeleted: user.isDeleted,
        };

        next();

    } catch (error) {
        next(error)
    }
}

export default checkAuth;
