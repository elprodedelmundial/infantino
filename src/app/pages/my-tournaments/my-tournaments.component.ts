import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { JoinedTournament } from '../../models/tournament.model';
import { FeatureFlagService } from '../../services/feature-flag.service';

@Component({
  selector: 'app-my-tournaments',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './my-tournaments.component.html',
  styleUrl: './my-tournaments.component.scss'
})
export class MyTournamentsComponent implements OnInit {
  username: string = 'Usuario';
  joinedTournaments: JoinedTournament[] = [];
  isLoading: boolean = true;
  featureFlagsLoaded: boolean = false;
  allowNewGroups: boolean = false;

  showCreateGroup = false;
  createGroupName = '';
  createGroupMaxMembers = 20;
  createGroupIsPrivate = false;
  createGroupError = '';
  isCreatingGroup = false;

  get memberGroups(): JoinedTournament[] {
    return this.joinedTournaments.filter(t => t.role !== 'CANDIDATE');
  }

  get candidateGroups(): JoinedTournament[] {
    return this.joinedTournaments.filter(t => t.role === 'CANDIDATE');
  }

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    private featureFlagService: FeatureFlagService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }

    this.featureFlagService.isNewGroupsAllowed().subscribe({
      next: allowed => {
        this.allowNewGroups = allowed;
        this.featureFlagsLoaded = true;
      },
      error: () => {
        this.allowNewGroups = false;
        this.featureFlagsLoaded = true;
      }
    });

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

  openCreateGroup(): void {
    this.createGroupName = '';
    this.createGroupMaxMembers = 20;
    this.createGroupIsPrivate = false;
    this.createGroupError = '';
    this.showCreateGroup = true;
  }

  closeCreateGroup(): void {
    if (this.isCreatingGroup) return;
    this.showCreateGroup = false;
    this.createGroupError = '';
  }

  submitCreateGroup(): void {
    const name = this.createGroupName.trim();
    if (!name) {
      this.createGroupError = 'Ingresá un nombre para el grupo';
      return;
    }
    if (this.createGroupMaxMembers < 1) {
      this.createGroupError = 'El máximo de miembros debe ser al menos 1';
      return;
    }

    this.isCreatingGroup = true;
    this.createGroupError = '';

    this.tournamentService.createGroup({
      name,
      maxMembers: this.createGroupMaxMembers,
      isPrivate: this.createGroupIsPrivate
    }).subscribe({
      next: groupId => {
        this.isCreatingGroup = false;
        this.showCreateGroup = false;
        this.loadTournaments();
        this.router.navigate(['/tournament', groupId], {
          state: { username: this.username, role: 'OWNER' }
        });
      },
      error: (error: Error) => {
        this.isCreatingGroup = false;
        this.createGroupError = error?.message || 'Error al crear el grupo';
      }
    });
  }

  openTournament(tournament: JoinedTournament): void {
    this.router.navigate(['/tournament', tournament.tournament.id], {
      state: { username: this.username, role: tournament.role }
    });
  }

  formatRanking(ranking: number | null): string {
    return ranking !== null ? `${ranking}º` : '-';
  }
}
