import { IErrorSource } from "../interfaces/interfaces";

class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorSources: IErrorSource[];
    public readonly isOperational: boolean;

    constructor(
        statusCode: number,
        message: string,
        errorSources: IErrorSource[] = [],
        stack?: string,
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errorSources = errorSources;
        this.isOperational = true;

        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default AppError;
