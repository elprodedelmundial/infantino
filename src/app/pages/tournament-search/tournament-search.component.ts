import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { TournamentService } from '../../services/tournament.service';
import { Tournament } from '../../models/tournament.model';

@Component({
  selector: 'app-tournament-search',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './tournament-search.component.html',
  styleUrl: './tournament-search.component.scss'
})
export class TournamentSearchComponent implements OnInit {
  username: string = 'Usuario';
  tournaments: Tournament[] = [];
  isLoading: boolean = true;
  joiningId: string | null = null;

  constructor(
    private router: Router,
    private tournamentService: TournamentService
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
    this.tournamentService.getAvailableTournaments().subscribe(tournaments => {
      this.tournaments = tournaments;
      this.isLoading = false;
    });
  }

  joinTournament(tournament: Tournament): void {
    if (tournament.isJoined || this.joiningId) return;
    
    this.joiningId = tournament.id;
    this.tournamentService.joinTournament(tournament.id).subscribe(() => {
      tournament.isJoined = true;
      tournament.participantsCount++;
      this.joiningId = null;
    });
  }

  goBack(): void {
    this.router.navigate(['/my-tournaments'], {
      state: { username: this.username }
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
