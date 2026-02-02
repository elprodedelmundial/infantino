import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserProfile, UserProfileUpdate, RegisterUserData } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  
  private currentUser: UserProfile = {
    id: 'user-1',
    username: 'Usuario',
    fullName: 'Usuario Demo',
    email: 'usuario@ejemplo.com',
    avatarUrl: undefined
  };

  private userSubject = new BehaviorSubject<UserProfile>(this.currentUser);
  user$ = this.userSubject.asObservable();

  register(data: RegisterUserData): Observable<UserProfile> {
    // Log registration data to console
    console.log('========================================');
    console.log('📝 NUEVO USUARIO REGISTRADO');
    console.log('========================================');
    console.log('Nombre Completo:', data.fullName);
    console.log('Nombre de Usuario:', data.username || '(no especificado)');
    console.log('Email:', data.email);
    console.log('Contraseña:', data.password);
    console.log('========================================');

    // Create new user profile
    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      fullName: data.fullName,
      username: data.username || data.email.split('@')[0],
      email: data.email,
      avatarUrl: undefined
    };

    // Update current user
    this.currentUser = newUser;
    this.userSubject.next(this.currentUser);

    return of(newUser).pipe(delay(500));
  }

  login(email: string, password: string): Observable<UserProfile> {
    // Log login attempt to console
    console.log('========================================');
    console.log('🔐 INICIO DE SESIÓN');
    console.log('========================================');
    console.log('Email:', email);
    console.log('Contraseña:', password);
    console.log('========================================');

    // Mock login - create user from email
    const username = email.split('@')[0];
    this.currentUser = {
      ...this.currentUser,
      username,
      fullName: username,
      email: email
    };
    this.userSubject.next(this.currentUser);

    return of(this.currentUser).pipe(delay(300));
  }

  setUsername(username: string): void {
    this.currentUser = {
      ...this.currentUser,
      username,
      fullName: username,
      email: `${username.toLowerCase()}@ejemplo.com`
    };
    this.userSubject.next(this.currentUser);
  }

  getUserProfile(): Observable<UserProfile> {
    return of(this.currentUser).pipe(delay(200));
  }

  updateProfile(update: UserProfileUpdate): Observable<UserProfile> {
    if (update.fullName) this.currentUser.fullName = update.fullName;
    if (update.username) this.currentUser.username = update.username;
    if (update.email) this.currentUser.email = update.email;
    if (update.avatarUrl !== undefined) this.currentUser.avatarUrl = update.avatarUrl;
    
    this.userSubject.next(this.currentUser);
    return of(this.currentUser).pipe(delay(300));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    // Mock password change - always succeeds if current password is not empty
    if (currentPassword && newPassword) {
      return of(true).pipe(delay(300));
    }
    return of(false).pipe(delay(300));
  }
}
