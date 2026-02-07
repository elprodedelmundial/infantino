import { Observable, of, delay, BehaviorSubject } from 'rxjs';
import { UserProfile, UserProfileUpdate, RegisterUserData, RegistrationError } from '../../models/user.model';
import { IUserService } from '../user-service.interface';

// Not using @Injectable since this is created via factory
export class MockedUserService implements IUserService {
  
  private currentUser: UserProfile = {
    id: 'user-1',
    username: 'Usuario',
    fullName: 'Usuario Demo',
    email: 'usuario@ejemplo.com'
  };

  // Store registered users to simulate conflict detection
  private registeredUsers: { username: string; email: string }[] = [
    { username: 'admin', email: 'admin@ejemplo.com' },
    { username: 'test', email: 'test@ejemplo.com' }
  ];

  private userSubject = new BehaviorSubject<UserProfile>(this.currentUser);
  user$ = this.userSubject.asObservable();

  private logApiCall(method: string, endpoint: string, body?: object, headers?: object): void {
    console.log('========================================');
    console.log(`🔌 MOCK API CALL - ${method} ${endpoint}`);
    console.log('========================================');
    if (headers) {
      console.log('Headers:', JSON.stringify(headers, null, 2));
    }
    if (body) {
      console.log('Request Body:', JSON.stringify(body, null, 2));
    }
    console.log('========================================');
  }

  private log409Response(field: 'username' | 'email', rejectedValue: string): void {
    console.log('========================================');
    console.log('⚠️ MOCK API RESPONSE - 409 Conflict');
    console.log('========================================');
    console.log('Response Body:', JSON.stringify({
      status: 409,
      error: 'Conflict',
      message: field === 'username' 
        ? `El nombre de usuario '${rejectedValue}' ya está en uso`
        : `El correo electrónico '${rejectedValue}' ya está registrado`,
      field,
      rejectedValue,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log('========================================');
  }

  register(data: RegisterUserData): Observable<UserProfile> {
    this.logApiCall('POST', '/api/users', {
      fullname: data.fullName,
      username: data.username,
      email: data.email,
      password: data.password
    });

    // Check for conflicts (simulating API behavior)
    const usernameConflict = this.registeredUsers.find(u => u.username.toLowerCase() === data.username.toLowerCase());
    if (usernameConflict) {
      this.log409Response('username', data.username);
      const error: RegistrationError = {
        message: `El nombre de usuario '${data.username}' ya está en uso`,
        field: 'username',
        rejectedValue: data.username
      };
      return new Observable(subscriber => {
        setTimeout(() => subscriber.error(error), 500);
      });
    }

    const emailConflict = this.registeredUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase());
    if (emailConflict) {
      this.log409Response('email', data.email);
      const error: RegistrationError = {
        message: `El correo electrónico '${data.email}' ya está registrado`,
        field: 'email',
        rejectedValue: data.email
      };
      return new Observable(subscriber => {
        setTimeout(() => subscriber.error(error), 500);
      });
    }

    // Log registration data to console
    console.log('========================================');
    console.log('📝 NUEVO USUARIO REGISTRADO (MOCK)');
    console.log('========================================');
    console.log('Nombre Completo:', data.fullName);
    console.log('Nombre de Usuario:', data.username);
    console.log('Email:', data.email);
    console.log('Contraseña:', data.password);
    console.log('========================================');

    // Store the new user to simulate conflict detection in future registrations
    this.registeredUsers.push({ username: data.username, email: data.email });

    // Create new user profile
    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      fullName: data.fullName,
      username: data.username,
      email: data.email
    };

    // Update current user
    this.currentUser = newUser;
    this.userSubject.next(this.currentUser);

    return of(newUser).pipe(delay(500));
  }

  login(email: string, password: string): Observable<UserProfile> {
    this.logApiCall('POST', '/api/users/login', {
      username: email,
      password: password
    });

    // Log login attempt to console
    console.log('========================================');
    console.log('🔐 INICIO DE SESIÓN (MOCK)');
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
    console.log('========================================');
    console.log('📝 SET USERNAME (MOCK - local only, no API call)');
    console.log('Username:', username);
    console.log('========================================');

    this.currentUser = {
      ...this.currentUser,
      username,
      fullName: username,
      email: `${username.toLowerCase()}@ejemplo.com`
    };
    this.userSubject.next(this.currentUser);
  }

  getUserProfile(): Observable<UserProfile> {
    this.logApiCall('GET', '/api/users/me', undefined, {
      'Authorization': 'Bearer <jwt-token>'
    });

    return of(this.currentUser).pipe(delay(200));
  }

  updateProfile(update: UserProfileUpdate): Observable<UserProfile> {
    // Build the request body (only include defined fields)
    const requestBody: any = {};
    if (update.fullName) requestBody.fullname = update.fullName;
    if (update.username) requestBody.username = update.username;
    if (update.email) requestBody.email = update.email;
    if (update.newPassword) requestBody.password = update.newPassword;

    this.logApiCall('PATCH', '/api/users', requestBody, {
      'Authorization': 'Bearer <jwt-token>'
    });

    // Update local state
    if (update.fullName) this.currentUser.fullName = update.fullName;
    if (update.username) this.currentUser.username = update.username;
    if (update.email) this.currentUser.email = update.email;
    
    this.userSubject.next(this.currentUser);
    return of(this.currentUser).pipe(delay(300));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    this.logApiCall('PATCH', '/api/users', {
      password: newPassword
    }, {
      'Authorization': 'Bearer <jwt-token>'
    });

    // Mock password change - always succeeds if current password is not empty
    if (currentPassword && newPassword) {
      return of(true).pipe(delay(300));
    }
    return of(false).pipe(delay(300));
  }

  deleteUser(): Observable<boolean> {
    this.logApiCall('DELETE', `/api/users/${this.currentUser.id}`, undefined, {
      'Authorization': 'Bearer <jwt-token>'
    });

    console.log('========================================');
    console.log('🗑️ USUARIO ELIMINADO (MOCK)');
    console.log('========================================');
    console.log('User ID:', this.currentUser.id);
    console.log('Username:', this.currentUser.username);
    console.log('========================================');

    return of(true).pipe(delay(300));
  }
}
