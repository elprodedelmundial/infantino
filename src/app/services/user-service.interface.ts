import { Observable } from 'rxjs';
import { UserProfile, UserProfileUpdate, RegisterUserData } from '../models/user.model';

export interface IUserService {
  user$: Observable<UserProfile>;
  
  register(data: RegisterUserData): Observable<UserProfile>;
  login(email: string, password: string): Observable<UserProfile>;
  setUsername(username: string): void;
  getUserProfile(): Observable<UserProfile>;
  updateProfile(update: UserProfileUpdate): Observable<UserProfile>;
  changePassword(currentPassword: string, newPassword: string): Observable<boolean>;
  deleteUser(): Observable<boolean>;
}

export const USER_SERVICE = 'USER_SERVICE';
