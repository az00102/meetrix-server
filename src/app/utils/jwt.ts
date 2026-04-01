import { JWTPayload } from "better-auth";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

type TokenVerificationResult =
    | {
          success: true;
          data: JWTPayload;
      }
    | {
          success: false;
          message: string;
          error: Error;
      };

const createToken = (payload: JwtPayload, secret: string, { expiresIn }: SignOptions) => {
    const token = jwt.sign(payload, secret, { expiresIn });

    return token
}

const verifyToken = (token: string, secret: string): TokenVerificationResult => {
    try {
        const verifiedData = jwt.verify(token, secret) as JWTPayload;

        return {
            success: true,
            data: verifiedData
        }

    } catch (error: unknown) {
        const normalizedError =
            error instanceof Error
                ? error
                : new Error("Token verification failed.");

        return {
            success: false,
            message: normalizedError.message,
            error: normalizedError
        }
    }

}

const decodedToken = (token: string) => {
    const decoded = jwt.decode(token) as JWTPayload;

    return decoded
}

export const jwtUtils = {
    createToken,
    verifyToken,
    decodedToken
}
