import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { UserProfile } from '../../models/user.model';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss'
})
export class ProfileEditComponent implements OnInit {
  username: string = 'Usuario';
  profile: UserProfile | null = null;
  isLoading: boolean = true;
  isSaving: boolean = false;
  isChangingPassword: boolean = false;
  isDeleting: boolean = false;
  showDeleteConfirm: boolean = false;
  
  // Form fields
  fullName: string = '';
  editUsername: string = '';
  email: string = '';
  
  // Password fields
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showPasswordForm: boolean = false;
  
  // Messages
  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    private router: Router,
    @Inject(USER_SERVICE) private userService: IUserService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.userService.setUsername(this.username);
    }
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;
    this.userService.getUserProfile().subscribe(profile => {
      this.profile = profile;
      this.fullName = profile.fullName;
      this.editUsername = profile.username;
      this.email = profile.email;
      this.isLoading = false;
    });
  }

  saveProfile(): void {
    if (!this.fullName || !this.editUsername || !this.email) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios';
      return;
    }

    this.isSaving = true;
    this.clearMessages();

    this.userService.updateProfile({
      fullName: this.fullName,
      username: this.editUsername,
      email: this.email
    }).subscribe({
      next: (updatedProfile) => {
        this.profile = updatedProfile;
        this.username = updatedProfile.username;
        this.successMessage = 'Perfil actualizado correctamente';
        this.isSaving = false;
        
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error.message || 'Error al actualizar el perfil';
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  changePassword(): void {
    this.clearMessages();

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos de contraseña';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas nuevas no coinciden';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    this.isChangingPassword = true;

    this.userService.changePassword(this.currentPassword, this.newPassword).subscribe(success => {
      this.isChangingPassword = false;
      if (success) {
        this.successMessage = 'Contraseña actualizada correctamente';
        this.showPasswordForm = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      } else {
        this.errorMessage = 'Error al cambiar la contraseña';
      }
      
      setTimeout(() => this.clearMessages(), 3000);
    });
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  showDeleteConfirmDialog(): void {
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  confirmDeleteUser(): void {
    this.isDeleting = true;
    this.clearMessages();

    this.userService.deleteUser().subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        // Navigate to home page after deletion
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        this.errorMessage = error.message || 'Error al eliminar la cuenta';
        setTimeout(() => this.clearMessages(), 3000);
      }
    });
  }

  get initials(): string {
    return this.fullName ? this.fullName.substring(0, 2).toUpperCase() : 'US';
  }
}
