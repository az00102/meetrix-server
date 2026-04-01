import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

type ParsedRequestShape = {
    body?: Request["body"];
    params?: Request["params"];
    query?: Request["query"];
    cookies?: Request["cookies"];
};

const validateRequest = (schema: ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsedRequest = await schema.parseAsync({
                body: req.body,
                params: req.params,
                query: req.query,
                cookies: req.cookies,
            }) as ParsedRequestShape;

            if (parsedRequest.body) {
                req.body = parsedRequest.body;
            }

            if (parsedRequest.params) {
                req.params = parsedRequest.params;
            }

            if (parsedRequest.query) {
                req.query = parsedRequest.query;
            }

            if (parsedRequest.cookies) {
                req.cookies = parsedRequest.cookies;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

export default validateRequest;
