import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { UserProfile, UserProfileUpdate, RegisterUserData, RegistrationError, UserPermission, UserJoinRequest } from '../models/user.model';
import { IUserService } from './user-service.interface';
import { EnvironmentConfig } from '../config/environment.config';

interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
  email: string;
  fullname: string;
  /** grondona: USER | SUPERUSER */
  permissions?: string;
  /** Nullable flag indicating the user must set a new password after logging in */
  should_reset_password?: boolean;
}

interface JoinRequestUserApi {
  id: string;
  username: string;
  fullname: string;
}

interface JoinGroupRequestApi {
  group: {
    id: string;
    name: string;
    tournament_id: string;
  };
  users: JoinRequestUserApi[];
}

interface UserResponse {
  id: string;
  fullname: string;
  username: string;
  email: string;
  created_at?: string;
  updated_at?: string;
  /** grondona: USER | SUPERUSER */
  permissions?: string;
  /** From CurrentUserResponse: pending join requests for groups where user is admin */
  join_requests?: JoinGroupRequestApi[];
}

export interface ConflictErrorResponse {
  status: number;
  error: string;
  message: string;
  timestamp: string;
  data?: {
    field: string;
    rejected_value: string;
  };
}

// Not using @Injectable since this is created via factory
export class UserService implements IUserService {

  private static readonly DISPLAY_NAME_CACHE_KEY = 'prode_user_display_name_v1';

  private baseUrl: string;
  private token: string | null = null;

  private currentUser: UserProfile = {
    id: '',
    username: '',
    fullName: '',
    email: '',
    permissions: 'USER'
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

  private mapPermission(value?: string): UserPermission {
    const v = (value ?? '').toUpperCase();
    return v === 'SUPERUSER' ? 'SUPERUSER' : 'USER';
  }

  private mapUserResponse(response: UserResponse): UserProfile {
    const joinRequests: UserJoinRequest[] | undefined = response.join_requests?.length
      ? response.join_requests
          .filter(jr => jr.users?.length > 0)
          .map(jr => ({
            groupId: jr.group.id,
            groupName: jr.group.name,
            tournamentId: jr.group.tournament_id,
            users: jr.users.map(u => ({
              id: u.id,
              username: u.username,
              fullName: u.fullname?.trim() || u.username
            }))
          }))
      : undefined;

    return {
      id: response.id,
      username: response.username,
      fullName: response.fullname,
      email: response.email,
      permissions: this.mapPermission(response.permissions),
      joinRequests: joinRequests?.length ? joinRequests : undefined
    };
  }

  private mapAuthResponse(response: AuthResponse): UserProfile {
    return {
      id: response.user_id,
      username: response.username,
      fullName: response.fullname,
      email: response.email,
      permissions: this.mapPermission(response.permissions),
      shouldResetPassword: response.should_reset_password === true
    };
  }

  private persistDisplayNameCache(profile: UserProfile): void {
    const u = (profile.username ?? '').trim();
    const f = (profile.fullName ?? '').trim();
    if (!u || !f || f === u) return;
    try {
      localStorage.setItem(
        UserService.DISPLAY_NAME_CACHE_KEY,
        JSON.stringify({ username: u, fullName: f })
      );
    } catch {
      /* ignore */
    }
  }

  getCachedFullNameForUsername(username: string): string {
    const key = (username ?? '').trim();
    if (!key) return '';
    try {
      const raw = localStorage.getItem(UserService.DISPLAY_NAME_CACHE_KEY);
      if (!raw) return '';
      const o = JSON.parse(raw) as { username?: string; fullName?: string };
      if (o.username === key && o.fullName?.trim()) return o.fullName.trim();
    } catch {
      /* ignore */
    }
    return '';
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
        this.persistDisplayNameCache(this.currentUser);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapAuthResponse(response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Registration error:', error);

        if (error.status === 409) {
          const conflictError = error.error as ConflictErrorResponse;
          const field = conflictError.data?.field;
          const registrationError: RegistrationError = {
            message: field === 'username' ? 'Usuario ya registrado'
                   : field === 'email'    ? 'Email ya registrado'
                   : 'Dato ya registrado',
            field: (field === 'username' || field === 'email') ? field : undefined,
            rejectedValue: conflictError.data?.rejected_value
          };
          return throwError(() => registrationError);
        }

        const genericError: RegistrationError = {
          message: error.status >= 500 ? 'Error del servidor, por favor intenta más tarde'
                 : 'Error al crear la cuenta'
        };
        return throwError(() => genericError);
      })
    );
  }

  login(email: string, password: string): Observable<UserProfile> {
    const body = {
      user: email,
      password: password
    };

    return this.http.post<AuthResponse>(`${this.baseUrl}/api/users/login`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(response => {
        this.token = response.token;
        localStorage.setItem('auth_token', response.token);
        this.currentUser = this.mapAuthResponse(response);
        this.persistDisplayNameCache(this.currentUser);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapAuthResponse(response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Login error:', error);
        if (error.status === 400 || error.status === 401) {
          return throwError(() => new Error('Usuario o contraseña incorrecto'));
        }
        if (error.status >= 500) {
          return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        }
        return throwError(() => new Error('Error al iniciar sesión'));
      })
    );
  }

  forgotPassword(user: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/users/forgot-password`, { user }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => {
        console.error('Forgot password error:', error);
        if (error.status === 400) {
          return throwError(() => new Error('Usuario no encontrado'));
        }
        if (error.status >= 500) {
          return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        }
        return throwError(() => new Error('No se pudo enviar el correo de recuperación'));
      })
    );
  }

  setUsername(username: string): void {
    // Sync route/navigation username only — do not overwrite fullName (that broke the toolbar when /me fails).
    this.currentUser = {
      ...this.currentUser,
      username,
      permissions: this.currentUser.permissions
    };
    this.userSubject.next(this.currentUser);
  }

  getUserProfile(): Observable<UserProfile> {
    return this.http.get<UserResponse>(`${this.baseUrl}/api/users/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        this.currentUser = this.mapUserResponse(response);
        this.persistDisplayNameCache(this.currentUser);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapUserResponse(response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Get profile error:', error);
        if (error.status === 401) return throwError(() => new Error('Sesión expirada, por favor iniciá sesión nuevamente'));
        if (error.status === 404) return throwError(() => new Error('Usuario no encontrado'));
        if (error.status >= 500) return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        return throwError(() => new Error('Error al obtener el perfil'));
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
        this.persistDisplayNameCache(this.currentUser);
        this.userSubject.next(this.currentUser);
      }),
      map(response => this.mapUserResponse(response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Update profile error:', error);
        if (error.status === 409) {
          const conflictError = error.error as ConflictErrorResponse;
          const field = conflictError.data?.field;
          const message = field === 'username' ? 'Usuario ya registrado'
                        : field === 'email'    ? 'Email ya registrado'
                        : 'Dato ya registrado';
          return throwError(() => new Error(message));
        }
        if (error.status === 401) return throwError(() => new Error('Sesión expirada, por favor iniciá sesión nuevamente'));
        if (error.status >= 500) return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        return throwError(() => new Error('Error al actualizar el perfil'));
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
      catchError((error: HttpErrorResponse) => {
        console.error('Change password error:', error);
        if (error.status === 401) return throwError(() => new Error('Sesión expirada, por favor iniciá sesión nuevamente'));
        if (error.status >= 500) return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        return throwError(() => new Error('Error al cambiar la contraseña'));
      })
    );
  }

  updatePredictionMode(unique: boolean, masterGroupId?: string | null): Observable<boolean> {
    const body: Record<string, unknown> = { unique_predictions: unique };
    if (masterGroupId !== undefined) {
      body['unique_predictions_master'] = masterGroupId ?? null;
    }
    return this.http.patch<UserResponse>(`${this.baseUrl}/api/users`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        console.error('Update prediction mode error:', error);
        if (error.status === 401) return throwError(() => new Error('Sesión expirada'));
        if (error.status >= 500) return throwError(() => new Error('Error del servidor'));
        return throwError(() => new Error('Error al actualizar el modo de predicciones'));
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
        localStorage.removeItem(UserService.DISPLAY_NAME_CACHE_KEY);
        this.currentUser = {
          id: '',
          username: '',
          fullName: '',
          email: '',
          permissions: 'USER'
        };
        this.userSubject.next(this.currentUser);
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        console.error('Delete user error:', error);
        if (error.status === 401) return throwError(() => new Error('Sesión expirada, por favor iniciá sesión nuevamente'));
        if (error.status === 404) return throwError(() => new Error('Usuario no encontrado'));
        if (error.status >= 500) return throwError(() => new Error('Error del servidor, por favor intenta más tarde'));
        return throwError(() => new Error('Error al eliminar la cuenta'));
      })
    );
  }
}
