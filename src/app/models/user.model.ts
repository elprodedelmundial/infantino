/** From grondona auth and GET /api/users/me (`permissions` field). */
export type UserPermission = 'USER' | 'SUPERUSER';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  permissions: UserPermission;
}

export interface UserProfileUpdate {
  fullName?: string;
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

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
