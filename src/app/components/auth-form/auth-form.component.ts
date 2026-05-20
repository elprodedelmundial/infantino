import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { RegistrationError } from '../../models/user.model';
import { FeatureFlagService } from '../../services/feature-flag.service';

type AuthTab = 'login' | 'register';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss'
})
export class AuthFormComponent {
  currentTab: AuthTab = 'login';
  
  // Login fields
  email: string = '';
  password: string = '';
  
  // Register fields
  fullName: string = '';
  username: string = '';
  confirmPassword: string = '';
  
  isSubmitting: boolean = false;
  errorMessage: string = '';
  errorField: 'username' | 'email' | null = null;

  constructor(
    private router: Router,
    @Inject(USER_SERVICE) private userService: IUserService,
    private featureFlagService: FeatureFlagService
  ) {}

  switchTab(tab: AuthTab): void {
    this.currentTab = tab;
    this.clearErrors();
    // Reset form fields when switching tabs
    this.email = '';
    this.password = '';
    this.fullName = '';
    this.username = '';
    this.confirmPassword = '';
  }

  onSubmit(): void {
    this.clearErrors();
    
    if (this.currentTab === 'login') {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private clearErrors(): void {
    this.errorMessage = '';
    this.errorField = null;
  }

  private handleLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isSubmitting = true;
    
    this.userService.login(this.email, this.password).subscribe({
      next: (user) => {
        this.isSubmitting = false;
        this.router.navigate(['/dashboard'], { 
          state: { username: user.username } 
        });
      },
      error: (error: Error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.message || 'Error al iniciar sesión';
      }
    });
  }

  private handleRegister(): void {
    // Validate required fields (username is now mandatory)
    if (!this.fullName || !this.username || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios';
      return;
    }

    // Validate username format (min 3 characters)
    if (this.username.length < 3) {
      this.errorMessage = 'El nombre de usuario debe tener al menos 3 caracteres';
      this.errorField = 'username';
      return;
    }

    if (/\s/.test(this.username)) {
      this.errorMessage = 'El nombre de usuario no puede contener espacios';
      this.errorField = 'username';
      return;
    }

    // Validate password confirmation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = '¡Las contraseñas no coinciden!';
      return;
    }

    // Validate password length
    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    this.isSubmitting = true;

    this.featureFlagService.isUserRegistrationAllowed().subscribe({
      next: isAllowed => {
        if (!isAllowed) {
          this.isSubmitting = false;
          this.errorMessage = 'Actualmente no está permitido registrar nuevos usuarios';
          return;
        }

        this.submitRegistration();
      },
      error: () => {
        this.submitRegistration();
      }
    });
  }

  private submitRegistration(): void {
    this.userService.register({
      fullName: this.fullName,
      username: this.username,
      email: this.email,
      password: this.password
    }).subscribe({
      next: (user) => {
        this.isSubmitting = false;
        this.router.navigate(['/dashboard'], { 
          state: { username: user.username } 
        });
      },
      error: (error: RegistrationError) => {
        this.isSubmitting = false;
        this.errorMessage = error.message || 'Error al crear la cuenta';
        this.errorField = error.field || null;
      }
    });
  }

  hasFieldError(field: 'username' | 'email'): boolean {
    return this.errorField === field;
  }

  get isLogin(): boolean {
    return this.currentTab === 'login';
  }

  get isRegister(): boolean {
    return this.currentTab === 'register';
  }
}
