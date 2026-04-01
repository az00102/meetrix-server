import { UserRole, UserStatus } from "../../generated/prisma/enums";

export interface IErrorSource {
    path: string;
    message: string;
}

export interface IErrorResponse {
    statusCode: number;
    success: boolean;
    message: string;
    errorSources: IErrorSource[];
    error?: unknown;
    stack?: string;
}

export interface IAuthUser {
    userId: string;
    role: UserRole;
    email: string;
    name: string
}

export interface ICurrentUserProfile {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: UserRole;
    status: UserStatus;
    phone: string | null;
    bio: string | null;
    isDeleted: boolean;
}

export interface IRequestUser {
    userId: string;
    role: UserRole;
    email: string;
}
