import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-toolbar.component.html',
  styleUrl: './user-toolbar.component.scss'
})
export class UserToolbarComponent {
  @Input() username: string = 'Usuario';
  
  isDropdownOpen: boolean = false;

  constructor(private router: Router) {}

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  editProfile(): void {
    this.closeDropdown();
    this.router.navigate(['/profile'], {
      state: { username: this.username }
    });
  }

  logout(): void {
    this.closeDropdown();
    this.router.navigate(['/']);
  }

  get initials(): string {
    return this.username.substring(0, 2).toUpperCase();
  }
}
