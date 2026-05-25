import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
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
    forkJoin({
      available: this.tournamentService.getAvailableTournaments(),
      joined: this.tournamentService.getJoinedTournaments()
    }).subscribe(({ available, joined }) => {
      const joinedById = new Map(joined.map(j => [j.tournament.id, j]));
      this.tournaments = available
        .map(t => {
        const membership = joinedById.get(t.id);
        if (membership?.role === 'CANDIDATE') {
          return {
            ...t,
            isPrivate: membership.tournament.isPrivate,
            isPendingApproval: true,
            isJoined: false
          };
        }
        return {
          ...t,
          isPrivate: membership?.tournament.isPrivate ?? t.isPrivate
        };
      })
        .sort((a, b) => Number(!!a.isPrivate) - Number(!!b.isPrivate));
      this.isLoading = false;
    });
  }

  joinTournament(tournament: Tournament): void {
    if (tournament.isJoined || tournament.isPendingApproval || this.joiningId) return;

    this.joiningId = tournament.id;
    this.tournamentService.joinTournament(tournament.id).subscribe(() => {
      this.tournamentService.getJoinedTournaments().subscribe(joined => {
        const membership = joined.find(j => j.tournament.id === tournament.id);
        if (membership?.role === 'CANDIDATE') {
          tournament.isPendingApproval = true;
          tournament.isJoined = false;
          tournament.isPrivate = membership.tournament.isPrivate;
        } else {
          tournament.isPendingApproval = false;
          tournament.isJoined = true;
          tournament.participantsCount++;
        }
        this.joiningId = null;
      });
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
