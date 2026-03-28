import { Response } from "express";

interface IResponseData<T> {
    responseStatus: number;
    success: boolean;
    responseMessage: string;
    data?: T;
}

const sendResponse = <T>(res: Response, responseData: IResponseData<T>) =>{
    const {responseStatus, success, responseMessage, data} = responseData;
    res.status(responseStatus).json({
        success,
        message: responseMessage,
        data
    });
}

export default sendResponse;