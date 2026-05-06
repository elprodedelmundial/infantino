/** From grondona auth and GET /api/users/me (`permissions` field). */
export type UserPermission = 'USER' | 'SUPERUSER';

/** A user waiting to join a group (from join_requests in CurrentUserResponse) */
export interface JoinRequestUser {
  id: string;
  username: string;
  fullName: string;
}

/** One entry in CurrentUserResponse.join_requests — a group with its pending users */
export interface UserJoinRequest {
  groupId: string;
  groupName: string;
  tournamentId: string;
  users: JoinRequestUser[];
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  permissions: UserPermission;
  /** Pending join requests for groups where this user is admin (from CurrentUserResponse) */
  joinRequests?: UserJoinRequest[];
}

export interface UserProfileUpdate {
  fullName?: string;
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  uniquePredictions?: boolean;
  /** Group id to use as the prediction source when uniquePredictions is true */
  uniquePredictionsMaster?: string | null;
}

export type PredictionMode = 'unique' | 'per_group';

export interface RegisterUserData {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface RegistrationError {
  message: string;
  field?: 'username' | 'email';
  rejectedValue?: string;
}
