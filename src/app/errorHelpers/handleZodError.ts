import z from "zod"
import { IErrorResponse, IErrorSource } from "../interfaces/interfaces"
import status from "http-status"

const handleZodError = (err: z.ZodError): IErrorResponse => {
    const statusCode = status.BAD_REQUEST;
    const message = "Validation error.";
    const errorSources: IErrorSource[] = [];

    err.issues.forEach(issue => {
        errorSources.push({
            path: issue.path.length > 0 ? issue.path.join('.') : 'body',
            message: issue.message
        })
    })

    return {
        statusCode,
        success: false,
        message,
        errorSources,
    }
}

export default handleZodError;
