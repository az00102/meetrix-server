import type { IAuthUser, ICurrentUserProfile } from "../interfaces/interfaces";

declare global {
    namespace Express {
        interface Request {
            user?: IAuthUser;
            currentUser?: ICurrentUserProfile;
        }
    }
}

export { }
