import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { AuthServices } from "./auth.service";
import sendResponse from "../../shared/sendResponse";
import status from "http-status";
import { tokenUtils } from "../../utils/token";
import AppError from "../../errorHelpers/AppError";
import { cookieUtils } from "../../utils/cookie";

const registerUserController = catchAsync(async (req: Request, res: Response) => {

    console.log("User Registration in progress...");

    const result = await AuthServices.registerUser(req.body);

    const { accessToken, refreshToken, token, ...rest } = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);
    tokenUtils.setBetterAuthCookie(res, token as string);

    sendResponse(res, {
        responseStatus: status.CREATED,
        success: true,
        responseMessage: "User registered successfully",
        data: {
            token,
            accessToken,
            refreshToken,
            ...rest
        }
    })
});

const loginUserController = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthServices.loginUser(req.body);

    const { accessToken, refreshToken, token, ...rest } = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);
    tokenUtils.setBetterAuthCookie(res, token)

    sendResponse(res, {
        responseStatus: status.OK,
        success: true,
        responseMessage: "User logged in successfully",
        data: {
            token,
            accessToken,
            refreshToken,
            ...rest
        }
    })
});

const getNewTokenController = catchAsync(
    async (req: Request, res: Response) => {
        const refreshToken = req.cookies.refreshToken;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];

        if (!refreshToken) {
            throw new AppError(status.UNAUTHORIZED, "Refresh Token is missing");
        }

        const result = await AuthServices.getNewToken(refreshToken, betterAuthSessionToken)

        const { accessToken: newAccessToken, refreshToken: newRefreshToken, sessionToken } = result;

        tokenUtils.setAccessTokenCookie(res, newAccessToken);
        tokenUtils.setRefreshTokenCookie(res, newRefreshToken);
        tokenUtils.setBetterAuthCookie(res, sessionToken);

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "New Token Generated Successfully!",
            data: {
                newAccessToken,
                newRefreshToken,
                sessionToken
            }
        })
    }
);

const logoutUserController = catchAsync(
    async (req: Request, res: Response) => {
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];

        const result = await AuthServices.logoutUser(betterAuthSessionToken);

        cookieUtils.clearCookie(res, 'accessToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        })

        cookieUtils.clearCookie(res, 'refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        })

        cookieUtils.clearCookie(res, 'better-auth.session_token', {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        })

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "User Logged Out successfully!",
            data: result
        })
    }
);

const getMeController = catchAsync(
    async (req: Request, res: Response) => {
        const currentUser = req.currentUser;

        if (!currentUser) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
        }

        const result = await AuthServices.getMe(currentUser);

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "User data fetched successfully.",
            data: result
        })

    }
)

const updateMeController = catchAsync(
    async (req: Request, res: Response) => {
        const currentUser = req.currentUser;

        if (!currentUser) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access.");
        }

        const result = await AuthServices.updateMe(currentUser, req.body);

        tokenUtils.setAccessTokenCookie(res, result.accessToken);
        tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

        sendResponse(res, {
            responseStatus: status.OK,
            success: true,
            responseMessage: "Profile updated successfully.",
            data: result.user,
        });
    },
)

export const AuthControllers = {
    registerUserController,
    loginUserController,
    getNewTokenController,
    logoutUserController,
    getMeController,
    updateMeController,
}
