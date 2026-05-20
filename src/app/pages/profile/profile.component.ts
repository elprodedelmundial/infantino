import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { UserProfile } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  username = 'Usuario';
  profile: UserProfile | null = null;
  isLoading = true;

  constructor(@Inject(USER_SERVICE) private userService: IUserService) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.userService.setUsername(this.username);
    }

    this.userService.getUserProfile().subscribe({
      next: profile => {
        this.profile = profile;
        this.username = profile.username;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get displayName(): string {
    return this.profile?.fullName || this.userService.getCachedFullNameForUsername(this.username) || this.username;
  }

  get handle(): string {
    const value = this.profile?.username || this.username;
    return `@${value}`;
  }

  get initials(): string {
    return this.displayName.substring(0, 2).toUpperCase();
  }
}
