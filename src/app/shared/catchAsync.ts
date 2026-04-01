import { NextFunction, Request, RequestHandler, Response } from "express";

const catchAsync = <
    TParams extends Request["params"] = Request["params"],
    TResponseBody = unknown,
    TRequestBody = unknown,
    TRequestQuery = Request["query"],
    TLocals extends Record<string, unknown> = Record<string, unknown>,
>(
    fn: RequestHandler<
        TParams,
        TResponseBody,
        TRequestBody,
        TRequestQuery,
        TLocals
    >,
): RequestHandler<
    TParams,
    TResponseBody,
    TRequestBody,
    TRequestQuery,
    TLocals
> => {
    return async (
        req: Request<
            TParams,
            TResponseBody,
            TRequestBody,
            TRequestQuery,
            TLocals
        >,
        res: Response<TResponseBody, TLocals>,
        next: NextFunction,
    ) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            next(error);
        }
    };
};

// export const catchAsync = (fn: RequestHandler): RequestHandler => {
//     return (req: Request, res: Response, next: NextFunction) => {
//         Promise.resolve(fn(req, res, next)).catch(next);
//     };
// };

export default catchAsync;
