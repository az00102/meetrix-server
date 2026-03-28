import { JWTPayload } from "better-auth";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const createToken = (payload: JwtPayload, secret: string, { expiresIn }: SignOptions) => {
    const token = jwt.sign(payload, secret, { expiresIn });

    return token
}

const verifyToken = (token: string, secret: string) => {
    try {
        const verifiedData = jwt.verify(token, secret) as JWTPayload;

        return {
            success: true,
            data: verifiedData
        }

    } catch (error: any) {

        return {
            success: false,
            message: error.message,
            error
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