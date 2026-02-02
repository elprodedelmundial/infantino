export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface UserProfileUpdate {
  fullName?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface RegisterUserData {
  fullName: string;
  username?: string;
  email: string;
  password: string;
}
