import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import { envVars } from "../../config/env";
import { Prisma } from "../../generated/prisma/client";
import AppError from "../errorHelpers/AppError";
import handleZodError from "../errorHelpers/handleZodError";
import { IErrorResponse, IErrorSource } from "../interfaces/interfaces";

const buildErrorResponse = (
    statusCode: number,
    message: string,
    errorSources: IErrorSource[] = [],
): IErrorResponse => ({
    statusCode,
    success: false,
    message,
    errorSources,
});

const getDefaultErrorSource = (message: string): IErrorSource[] => [
    {
        path: "",
        message,
    },
];

const isInvalidJsonBodyError = (
    error: unknown,
): error is SyntaxError & { status: number; body: unknown } => {
    return (
        error instanceof SyntaxError &&
        "status" in error &&
        typeof error.status === "number" &&
        error.status === status.BAD_REQUEST &&
        "body" in error
    );
};

const handlePrismaError = (
    error: Prisma.PrismaClientKnownRequestError,
): IErrorResponse => {
    if (error.code === "P2002") {
        const targetField = Array.isArray(error.meta?.target)
            ? error.meta.target.join(", ")
            : "field";

        return buildErrorResponse(
            status.CONFLICT,
            "Duplicate value violates a unique constraint.",
            [
                {
                    path: targetField,
                    message: `${targetField} already exists.`,
                },
            ],
        );
    }

    if (error.code === "P2025") {
        return buildErrorResponse(
            status.NOT_FOUND,
            "Requested resource was not found.",
            getDefaultErrorSource("Requested resource was not found."),
        );
    }

    return buildErrorResponse(
        status.BAD_REQUEST,
        "Database request failed.",
        getDefaultErrorSource("Database request failed."),
    );
};

const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    let simplifiedError: IErrorResponse = buildErrorResponse(
        status.INTERNAL_SERVER_ERROR,
        "Something went wrong.",
        [],
    );

    if (error instanceof ZodError) {
        simplifiedError = handleZodError(error);
    } else if (error instanceof AppError) {
        simplifiedError = buildErrorResponse(
            error.statusCode,
            error.message,
            error.errorSources.length > 0
                ? error.errorSources
                : getDefaultErrorSource(error.message),
        );
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        simplifiedError = handlePrismaError(error);
    } else if (isInvalidJsonBodyError(error)) {
        simplifiedError = buildErrorResponse(
            status.BAD_REQUEST,
            "Invalid JSON payload.",
            getDefaultErrorSource("Request body contains malformed JSON."),
        );
    } else if (error instanceof Error) {
        simplifiedError = buildErrorResponse(
            status.INTERNAL_SERVER_ERROR,
            envVars.NODE_ENV === "development"
                ? error.message
                : "Something went wrong.",
            getDefaultErrorSource(
                envVars.NODE_ENV === "development"
                    ? error.message
                    : "Internal server error.",
            ),
        );
    }

    if (!(error instanceof AppError) && !(error instanceof ZodError)) {
        console.error(`[${req.method}] ${req.originalUrl}`, error);
    }

    res.status(simplifiedError.statusCode).json({
        success: false,
        message: simplifiedError.message,
        errorSources: simplifiedError.errorSources,
        stack: envVars.NODE_ENV === "development" ? error.stack : undefined,
    });
};

export default globalErrorHandler;
