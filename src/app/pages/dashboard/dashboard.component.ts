import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  username: string = 'Usuario';

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { username: string } | undefined;
    
    if (state?.username) {
      this.username = state.username;
    } else {
      const historyState = history.state as { username: string } | undefined;
      if (historyState?.username) {
        this.username = historyState.username;
      }
    }
    
    this.tournamentService.setCurrentUser(this.username);
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
}
