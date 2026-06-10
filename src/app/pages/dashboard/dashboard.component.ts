import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { AwardsReminderComponent } from '../../components/awards-reminder/awards-reminder.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { AwardsReminderService } from '../../services/awards-reminder.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent, AwardsReminderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  username: string = 'Usuario';

  // Forced password change banner (should_reset_password from login)
  passwordResetRequired: boolean = false;
  newPassword: string = '';
  confirmNewPassword: string = '';
  passwordResetError: string = '';
  isPasswordResetSubmitting: boolean = false;

  /** Awards-predictions reminder, shown once per login until the user submits. */
  showAwardsReminder: boolean = false;

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    @Inject(USER_SERVICE) private userService: IUserService,
    private awardsReminder: AwardsReminderService
  ) {}

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as
      | { username?: string; shouldResetPassword?: boolean; fromLogin?: boolean }
      | undefined;
    const historyState = history.state as
      | { username?: string; shouldResetPassword?: boolean; fromLogin?: boolean }
      | undefined;

    const resolvedState = state ?? historyState;
    if (resolvedState?.username) {
      this.username = resolvedState.username;
    }

    if (resolvedState?.shouldResetPassword) {
      this.passwordResetRequired = true;
    }

    // Only on a fresh login, and not while the forced password change is up.
    if (
      resolvedState?.fromLogin &&
      !this.passwordResetRequired &&
      this.awardsReminder.canShow(this.username)
    ) {
      this.showAwardsReminder = true;
    }

    this.tournamentService.setCurrentUser(this.username);
  }

  submitPasswordReset(): void {
    this.passwordResetError = '';

    if (!this.newPassword || !this.confirmNewPassword) {
      this.passwordResetError = 'Por favor completa todos los campos';
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordResetError = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordResetError = '¡Las contraseñas no coinciden!';
      return;
    }

    this.isPasswordResetSubmitting = true;

    this.userService.updateProfile({ newPassword: this.newPassword }).subscribe({
      next: () => {
        this.isPasswordResetSubmitting = false;
        this.passwordResetRequired = false;
        this.newPassword = '';
        this.confirmNewPassword = '';
      },
      error: (error: Error) => {
        this.isPasswordResetSubmitting = false;
        this.passwordResetError = error?.message || 'No se pudo actualizar la contraseña';
      }
    });
  }

  goToResults(): void {
    this.router.navigate(['/results'], {
      state: { username: this.username }
    });
  }

  goToMyTournaments(): void {
    this.router.navigate(['/my-tournaments'], {
      state: { username: this.username }
    });
  }

  goToRules(): void {
    this.router.navigate(['/rules'], {
      state: { username: this.username }
    });
  }
}
