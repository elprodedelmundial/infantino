import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { JoinedTournament } from '../../models/tournament.model';

@Component({
  selector: 'app-my-tournaments',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './my-tournaments.component.html',
  styleUrl: './my-tournaments.component.scss'
})
export class MyTournamentsComponent implements OnInit {
  username: string = 'Usuario';
  joinedTournaments: JoinedTournament[] = [];
  isLoading: boolean = true;

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    
    this.loadTournaments();
  }

  loadTournaments(): void {
    this.isLoading = true;
    this.tournamentService.getJoinedTournaments().subscribe(tournaments => {
      this.joinedTournaments = tournaments;
      this.isLoading = false;
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  searchTournament(): void {
    this.router.navigate(['/tournaments'], {
      state: { username: this.username }
    });
  }

  openTournament(tournament: JoinedTournament): void {
    this.router.navigate(['/tournament', tournament.tournament.id], {
      state: { username: this.username }
    });
  }

  getRankingSuffix(ranking: number): string {
    return 'º';
  }
}
