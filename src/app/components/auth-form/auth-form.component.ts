import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';

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

  constructor(
    private router: Router,
    private userService: UserService
  ) {}

  switchTab(tab: AuthTab): void {
    this.currentTab = tab;
    this.errorMessage = '';
    // Reset form fields when switching tabs
    this.email = '';
    this.password = '';
    this.fullName = '';
    this.username = '';
    this.confirmPassword = '';
  }

  onSubmit(): void {
    this.errorMessage = '';
    
    if (this.currentTab === 'login') {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
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
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Error al iniciar sesión';
      }
    });
  }

  private handleRegister(): void {
    // Validate required fields
    if (!this.fullName || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa los campos obligatorios';
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

    this.userService.register({
      fullName: this.fullName,
      username: this.username || undefined,
      email: this.email,
      password: this.password
    }).subscribe({
      next: (user) => {
        this.isSubmitting = false;
        this.router.navigate(['/dashboard'], { 
          state: { username: user.username } 
        });
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Error al crear la cuenta';
      }
    });
  }

  get isLogin(): boolean {
    return this.currentTab === 'login';
  }

  get isRegister(): boolean {
    return this.currentTab === 'register';
  }
}
