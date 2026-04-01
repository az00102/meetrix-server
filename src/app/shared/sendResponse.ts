import { Response } from "express";

interface IResponseMeta {
    [key: string]: unknown;
}

interface IResponseData<T> {
    responseStatus: number;
    success: boolean;
    responseMessage: string;
    data?: T;
    meta?: IResponseMeta;
}

const sendResponse = <T>(res: Response, responseData: IResponseData<T>) =>{
    const {responseStatus, success, responseMessage, data, meta} = responseData;
    res.status(responseStatus).json({
        success,
        message: responseMessage,
        meta,
        data
    });
}

export default sendResponse;
