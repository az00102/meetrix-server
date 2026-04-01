import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";

type ParsedRequestShape = {
    body?: Request["body"];
    params?: Request["params"];
    query?: Request["query"];
    cookies?: Request["cookies"];
};

type SchemaRequestShape<TSchema extends ZodTypeAny> = z.infer<TSchema>;

type ExtractRequestPart<
    TSchema extends ZodTypeAny,
    TKey extends keyof ParsedRequestShape,
> = SchemaRequestShape<TSchema> extends Record<TKey, infer TValue>
    ? TValue
    : ParsedRequestShape[TKey];

type ValidatedRequestData<TSchema extends ZodTypeAny> = {
    body?: ExtractRequestPart<TSchema, "body">;
    params?: ExtractRequestPart<TSchema, "params">;
    query?: ExtractRequestPart<TSchema, "query">;
    cookies?: ExtractRequestPart<TSchema, "cookies">;
};

const validateRequest = <TSchema extends ZodTypeAny>(schema: TSchema) => {
    return async (
        req: Request<
            ExtractRequestPart<TSchema, "params">,
            unknown,
            ExtractRequestPart<TSchema, "body">,
            ExtractRequestPart<TSchema, "query">
        >,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const parsedRequest = await schema.parseAsync({
                body: req.body,
                params: req.params,
                query: req.query,
                cookies: req.cookies,
            }) as ValidatedRequestData<TSchema>;

            if (parsedRequest.body !== undefined) {
                req.body = parsedRequest.body;
            }

            if (parsedRequest.params !== undefined) {
                req.params = parsedRequest.params;
            }

            if (parsedRequest.query !== undefined) {
                Object.defineProperty(req, "query", {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: parsedRequest.query,
                });
            }

            if (parsedRequest.cookies !== undefined) {
                req.cookies = parsedRequest.cookies as Request["cookies"];
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

export default validateRequest;
