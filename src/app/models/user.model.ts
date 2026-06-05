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

/** A team within a profile match summary (flag + names) */
export interface ProfileMatchTeam {
  code: string;
  name: string;
  flagUrl: string;
}

/** A match referenced from the user profile quota highlights */
export interface ProfileMatchSummary {
  id: string;
  code: string;
  homeTeam: ProfileMatchTeam;
  awayTeam: ProfileMatchTeam;
  homeGoals?: number;
  awayGoals?: number;
  homePenalties?: number;
  awayPenalties?: number;
  status: string;
  substatus?: string;
}

/** A user's prediction for a match (result + predicted score) shown in the profile */
export interface ProfilePrediction {
  match: ProfileMatchSummary;
  /** User's predicted home goals (null when there's no prediction) */
  predictedHome: number | null;
  predictedAway: number | null;
  status?: string;
}

/** A top quota prediction (best correct / worst incorrect) with its prediction */
export interface QuotaProfile {
  quota: number;
  prediction: ProfilePrediction;
}

/** Count of predicted matches per result status (grondona PredictionsProfileResponse) */
export interface PredictionsProfile {
  partial: number;
  correct: number;
  bonus: number;
  incorrect: number;
  missing: number;
}

/** Summary of the user's performance within a single group (grondona UserProfileResponse) */
export interface UserGroupPerformance {
  groupId: string;
  groupName: string;
  totalPoints: number;
  quotasPoints: number;
  /** null when the API doesn't report awards points */
  awardsPoints: number | null;
  commonMatches: PredictionsProfile;
  highlightedMatches: PredictionsProfile;
  topQuotaSucceeded: QuotaProfile | null;
  topQuotaFailed: QuotaProfile | null;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  permissions: UserPermission;
  /** Pending join requests for groups where this user is admin (from CurrentUserResponse) */
  joinRequests?: UserJoinRequest[];
  /** From login AuthResponse: user must set a new password before continuing */
  shouldResetPassword?: boolean;
  /** Per-group performance summary (from GET /me `profiles`) */
  profiles?: UserGroupPerformance[];
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
