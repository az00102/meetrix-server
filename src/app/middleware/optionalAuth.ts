import { NextFunction, Request, Response } from "express";
import { UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../../config/env";
import { prisma } from "../lib/prisma";
import { cookieUtils } from "../utils/cookie";
import { jwtUtils } from "../utils/jwt";

const isUserAccessible = (user: { status: UserStatus; isDeleted: boolean }) =>
    !user.isDeleted &&
    user.status !== UserStatus.DELETED &&
    user.status !== UserStatus.SUSPENDED &&
    user.status !== UserStatus.INACTIVE;

const optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const sessionToken = cookieUtils.getCookie(
            req,
            "better-auth.session_token",
        );
        const accessToken = cookieUtils.getCookie(req, "accessToken");

        if (!sessionToken || !accessToken) {
            return next();
        }

        const session = await prisma.session.findUnique({
            where: {
                token: sessionToken,
            },
            include: {
                user: true,
            },
        });

        if (
            !session ||
            !session.user ||
            session.expiresAt <= new Date() ||
            !isUserAccessible(session.user)
        ) {
            return next();
        }

        const verifiedToken = jwtUtils.verifyToken(
            accessToken,
            envVars.ACCESS_TOKEN_SECRET,
        );

        if (!verifiedToken.success || !verifiedToken.data) {
            return next();
        }

        if (
            verifiedToken.data.userId !== session.user.id ||
            verifiedToken.data.role !== session.user.role
        ) {
            return next();
        }

        req.user = {
            userId: session.user.id,
            role: session.user.role,
            email: session.user.email,
            name: session.user.name,
        };

        req.currentUser = {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            emailVerified: session.user.emailVerified,
            image: session.user.image,
            createdAt: session.user.createdAt,
            updatedAt: session.user.updatedAt,
            role: session.user.role,
            status: session.user.status,
            phone: session.user.phone,
            bio: session.user.bio,
            isDeleted: session.user.isDeleted,
        };

        next();
    } catch {
        next();
    }
};

export default optionalAuth;
