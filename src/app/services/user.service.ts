import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { UserProfile, UserProfileUpdate, RegisterUserData, RegistrationError } from '../models/user.model';
import { IUserService } from './user-service.interface';
import { EnvironmentConfig } from '../config/environment.config';

interface AuthResponse {
  token: string;
  userId: string;
  username: string;
  email: string;
  fullname: string;
}

interface UserResponse {
  id: string;
  fullname: string;
  username: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ConflictErrorResponse {
  status: number;
  error: string;
  message: string;
  field: 'username' | 'email';
  rejectedValue: string;
  timestamp: string;
}

// Not using @Injectable since this is created via factory
export class UserService implements IUserService {
  
  private baseUrl: string;
  private token: string | null = null;
  
  private currentUser: UserProfile = {
    id: '',
    username: '',
    fullName: '',
    email: ''
  };

  private userSubject = new BehaviorSubject<UserProfile>(this.currentUser);
  user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private config: EnvironmentConfig
  ) {
    this.baseUrl = config.grondonaUrl || '';
    // Try to restore token from localStorage
    this.token = localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }
    
    return headers;
  }

  private mapUserResponse(response: UserResponse): UserProfile {
    return {
      id: response.id,
      username: response.username,
      fullName: response.fullname,
      email: response.email
    };
  }

  private mapAuthResponse(response: AuthResponse): UserProfile {
    return {
      id: response.userId,
      username: response.username,
      fullName: response.fullname,
      email: response.email
    };
  }

  register(data: RegisterUserData): Observable<UserProfile> {
    const body = {
      fullname: data.fullName,
      username: data.username,
      email: data.email,
      password: data.password
    };

    return this.http.post<AuthResponse>(`${this.baseUrl}/api/users`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(response => {
        this.token = response.token;
        localStorage.setItem('auth_token', response.token);
        this.currentUser = this.mapAuthResponse(response);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapAuthResponse(response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Registration error:', error);
        
        // Handle 409 Conflict - username or email already exists
        if (error.status === 409) {
          const conflictError = error.error as ConflictErrorResponse;
          const registrationError: RegistrationError = {
            message: conflictError.message || this.getConflictMessage(conflictError.field, conflictError.rejectedValue),
            field: conflictError.field,
            rejectedValue: conflictError.rejectedValue
          };
          return throwError(() => registrationError);
        }
        
        // Handle other errors
        const genericError: RegistrationError = {
          message: error.error?.message || 'Registration failed'
        };
        return throwError(() => genericError);
      })
    );
  }

  private getConflictMessage(field: 'username' | 'email', value: string): string {
    if (field === 'username') {
      return `El nombre de usuario '${value}' ya está en uso`;
    } else if (field === 'email') {
      return `El correo electrónico '${value}' ya está registrado`;
    }
    return 'El valor ya existe';
  }

  login(email: string, password: string): Observable<UserProfile> {
    const body = {
      username: email,
      password: password
    };

    return this.http.post<AuthResponse>(`${this.baseUrl}/api/users/login`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(response => {
        this.token = response.token;
        localStorage.setItem('auth_token', response.token);
        this.currentUser = this.mapAuthResponse(response);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapAuthResponse(response)),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => new Error(error.error?.message || 'Invalid username or password'));
      })
    );
  }

  setUsername(username: string): void {
    // This is a local-only operation for UI state
    this.currentUser = {
      ...this.currentUser,
      username,
      fullName: username
    };
    this.userSubject.next(this.currentUser);
  }

  getUserProfile(): Observable<UserProfile> {
    return this.http.get<UserResponse>(`${this.baseUrl}/api/users/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        this.currentUser = this.mapUserResponse(response);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapUserResponse(response)),
      catchError(error => {
        console.error('Get profile error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to get user profile'));
      })
    );
  }

  updateProfile(update: UserProfileUpdate): Observable<UserProfile> {
    const body: any = {};
    if (update.fullName) body.fullname = update.fullName;
    if (update.username) body.username = update.username;
    if (update.email) body.email = update.email;
    if (update.newPassword) body.password = update.newPassword;

    return this.http.patch<UserResponse>(`${this.baseUrl}/api/users`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        this.currentUser = this.mapUserResponse(response);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapUserResponse(response)),
      catchError(error => {
        console.error('Update profile error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to update profile'));
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    // The API uses PATCH /api/users with password field
    const body = {
      password: newPassword
    };

    return this.http.patch<UserResponse>(`${this.baseUrl}/api/users`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => true),
      catchError(error => {
        console.error('Change password error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to change password'));
      })
    );
  }

  deleteUser(): Observable<boolean> {
    return this.http.delete<void>(`${this.baseUrl}/api/users/${this.currentUser.id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        // Clear local state
        this.token = null;
        localStorage.removeItem('auth_token');
        this.currentUser = {
          id: '',
          username: '',
          fullName: '',
          email: ''
        };
        this.userSubject.next(this.currentUser);
      }),
      map(() => true),
      catchError(error => {
        console.error('Delete user error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to delete user'));
      })
    );
  }
}
