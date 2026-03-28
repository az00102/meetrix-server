export interface IUserRegistrationPayload {
    name: string;
    email: string;
    password: string;
}

export interface ILoginPayload {
    email: string;
    password: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: string;
    status: string;
    phone?: string | null;
    bio?: string | null;
    isDeleted: boolean;
    deletedAt?: Date | null;
}

export interface ISessionResponse {
    session: Session;
    user: User;
}

export interface Session {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
}
