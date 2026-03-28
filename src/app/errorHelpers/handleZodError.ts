import z from "zod"
import { IErrorResponse, IErrorSource } from "../interfaces/interfaces"
import status from "http-status"

const handleZodError = (err: z.ZodError): IErrorResponse => {
    const statusCode = status.BAD_REQUEST;
    const message = "Zod Validation Error";
    const errorSources: IErrorSource[] = [];

    err.issues.forEach(issue => {
        errorSources.push({
            path: issue.path.join('=>'),
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