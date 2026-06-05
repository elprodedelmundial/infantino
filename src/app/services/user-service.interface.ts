import { Observable } from 'rxjs';
import { UserProfile, UserProfileUpdate, RegisterUserData, UserGroupPerformance } from '../models/user.model';

export interface IUserService {
  user$: Observable<UserProfile>;
  
  register(data: RegisterUserData): Observable<UserProfile>;
  login(email: string, password: string): Observable<UserProfile>;
  forgotPassword(user: string): Observable<void>;
  setUsername(username: string): void;
  /** Last known full name for this login (localStorage); used when GET /me fails. */
  getCachedFullNameForUsername(username: string): string;
  getUserProfile(): Observable<UserProfile>;
  /** Performance profile of another group member (GET .../groups/{groupId}/members/{memberId}). */
  getGroupMemberProfile(groupId: string, memberId: string): Observable<UserGroupPerformance | null>;
  updateProfile(update: UserProfileUpdate): Observable<UserProfile>;
  changePassword(currentPassword: string, newPassword: string): Observable<boolean>;
  deleteUser(): Observable<boolean>;
  /** PATCH unique_predictions (and optionally unique_predictions_master) on the current user. */
  updatePredictionMode(unique: boolean, masterGroupId?: string | null): Observable<boolean>;
}

export const USER_SERVICE = 'USER_SERVICE';
