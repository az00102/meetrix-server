import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import { envVars } from "../../config/env";
import AppError from "../errorHelpers/AppError";
import handleZodError from "../errorHelpers/handleZodError";
import { IErrorSource } from "../interfaces/interfaces";

const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
    let statusCode: number = status.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong.";
    let errorSources: IErrorSource[] = [];

    if (error instanceof ZodError) {
        const simplifiedError = handleZodError(error);

        statusCode = simplifiedError.statusCode;
        message = simplifiedError.message;
        errorSources = simplifiedError.errorSources;
    } else if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
        errorSources = [
            {
                path: "",
                message: error.message,
            },
        ];
    } else if (error instanceof Error) {
        message = error.message;
        errorSources = [
            {
                path: "",
                message: error.message,
            },
        ];
    }

    res.status(statusCode).json({
        success: false,
        message,
        errorSources,
        stack: envVars.NODE_ENV === "development" ? error.stack : undefined,
    });
};

export default globalErrorHandler;
