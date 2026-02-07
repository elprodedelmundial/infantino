export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
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
