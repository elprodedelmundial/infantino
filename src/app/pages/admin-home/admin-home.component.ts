import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss'
})
export class AdminHomeComponent {
  username = 'Usuario';

  constructor(private router: Router) {
    const st = history.state as { username?: string } | undefined;
    if (st?.username) this.username = st.username;
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], { state: { username: this.username } });
  }

  goEditTournament(): void {
    this.router.navigate(['/admin/tournament'], { state: { username: this.username } });
  }

  goAddMatches(): void {
    this.router.navigate(['/admin/matches'], { state: { username: this.username } });
  }

  goUpdateMatches(): void {
    this.router.navigate(['/admin/matches/update'], { state: { username: this.username } });
  }
}
