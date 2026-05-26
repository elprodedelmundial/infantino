import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import {
  AdminTournamentListItem,
  Country,
  Player,
  TournamentAwardWinners,
  emptyTournamentAwardWinners,
  isYoungPlayerAwardEligible
} from '../../models/tournament.model';
import { includesNormalized, matchesCountrySearch } from '../../utils/text-search.utils';

interface AdminAwardCategory {
  id: keyof TournamentAwardWinners;
  title: string;
  description: string;
  type: 'country' | 'player';
}

@Component({
  selector: 'app-admin-tournament',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './admin-tournament.component.html',
  styleUrl: './admin-tournament.component.scss'
})
export class AdminTournamentComponent implements OnInit {
  username = 'Usuario';
  tournaments: AdminTournamentListItem[] = [];
  selectedTournamentId = '';
  editName = '';
  editStatus = '';
  readonly statusOptions = [
    { value: 'NOT_STARTED', label: 'No iniciado' },
    { value: 'IN_PROGRESS', label: 'En curso' },
    { value: 'FINISHED', label: 'Finalizado' }
  ];

  winners: TournamentAwardWinners = emptyTournamentAwardWinners();
  countries: Country[] = [];
  allPlayers: Player[] = [];
  isLoading = true;
  isSaving = false;
  loadError: string | null = null;
  saveError: string | null = null;
  hasChanges = false;

  readonly categories: AdminAwardCategory[] = [
    { id: 'champion', title: 'Campeón', description: 'Equipo campeón', type: 'country' },
    { id: 'goldenBall', title: 'Balón de Oro', description: 'Mejor jugador', type: 'player' },
    { id: 'goldenBoot', title: 'Bota de Oro', description: 'Máximo goleador', type: 'player' },
    { id: 'goldenGlove', title: 'Guante de Oro', description: 'Solo arqueros (misma regla que predicciones)', type: 'player' },
    {
      id: 'bestYoungPlayer',
      title: 'Mejor Juvenil',
      description: 'Elegibles por fecha de nacimiento (misma regla que predicciones)',
      type: 'player'
    }
  ];
  activeCategory: AdminAwardCategory = this.categories[0];
  searchTerm = '';
  countryFilterCode = '';

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const st = history.state as { username?: string } | undefined;
    if (st?.username) this.username = st.username;

    this.tournamentService.getAdminTournaments().subscribe(list => {
      this.tournaments = list;
      this.selectedTournamentId = list[0]?.id ?? '';
      if (this.selectedTournamentId) this.loadTournament(this.selectedTournamentId);
      else this.isLoading = false;
    });
  }

  get statusSelectOptions(): { value: string; label: string }[] {
    const base = [...this.statusOptions];
    if (this.editStatus && !base.some(o => o.value === this.editStatus)) {
      return [{ value: this.editStatus, label: this.editStatus }, ...base];
    }
    return base;
  }

  onTournamentSelect(): void {
    if (this.selectedTournamentId) this.loadTournament(this.selectedTournamentId);
  }

  private loadTournament(tournamentId: string): void {
    this.isLoading = true;
    this.loadError = null;
    forkJoin({
      detail: this.tournamentService.getAdminTournamentDetail(tournamentId),
      countries: this.tournamentService.getCountriesForAwards(tournamentId),
      players: this.tournamentService.getTournamentPlayersForAwards(tournamentId)
    }).subscribe({
      next: ({ detail, countries, players }) => {
        this.countries = countries;
        this.allPlayers = players;
        if (detail) {
          this.editName = detail.name;
          this.editStatus = detail.status;
          this.winners = detail.awardWinners
            ? { ...detail.awardWinners }
            : emptyTournamentAwardWinners();
        } else {
          this.loadError = 'No se pudo cargar el torneo.';
          this.editName = '';
          this.editStatus = 'NOT_STARTED';
          this.winners = emptyTournamentAwardWinners();
        }
        this.hasChanges = false;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Error al cargar datos.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin'], { state: { username: this.username } });
  }

  markChanged(): void {
    this.hasChanges = true;
  }

  onNameChange(): void {
    this.markChanged();
  }

  onStatusChange(): void {
    this.markChanged();
  }

  setActiveCategory(cat: AdminAwardCategory): void {
    this.activeCategory = cat;
    this.searchTerm = '';
    if (cat.type !== 'player') this.countryFilterCode = '';
  }

  get countryFilterOptions(): Country[] {
    const byCode = new Map<string, Country>();
    for (const p of this.allPlayers) {
      const c = p.country;
      if (!byCode.has(c.code)) byCode.set(c.code, c);
    }
    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private playersForActiveCategory(): Player[] {
    switch (this.activeCategory.id) {
      case 'goldenGlove':
        return this.allPlayers.filter(p => p.positionCode === 'GOALKEEPER');
      case 'bestYoungPlayer':
        return this.allPlayers.filter(p => isYoungPlayerAwardEligible(p.birthdate));
      default:
        return this.allPlayers;
    }
  }

  getOptionsForCategory(): (Country | Player)[] {
    if (this.activeCategory.id === 'champion') return this.countries;
    return this.playersForActiveCategory();
  }

  getFilteredOptions(): (Country | Player)[] {
    let options = this.getOptionsForCategory();
    if (this.activeCategory.type === 'player' && this.countryFilterCode) {
      options = options.filter(o => (o as Player).country.code === this.countryFilterCode);
    }
    if (!this.searchTerm.trim()) return options;
    const term = this.searchTerm;
    return options.filter(opt => {
      if (this.activeCategory.type === 'country') {
        return matchesCountrySearch((opt as Country).name, term);
      }
      const pl = opt as Player;
      return (
        includesNormalized(pl.name, term) ||
        matchesCountrySearch(pl.country.name, term)
      );
    });
  }

  getNoResultsMessage(): string {
    const term = this.searchTerm.trim();
    const countryName =
      this.activeCategory.type === 'player' && this.countryFilterCode
        ? this.countryFilterOptions.find(c => c.code === this.countryFilterCode)?.name ??
          this.countryFilterCode
        : '';
    if (countryName && term) return `No hay resultados para "${term}" en ${countryName}`;
    if (countryName) return `No hay resultados para ${countryName}`;
    if (term) return `No hay resultados para "${term}"`;
    return 'No hay resultados';
  }

  getCurrentWinner(): Country | Player | null {
    return this.winners[this.activeCategory.id];
  }

  sameCountry(a: Country, b: Country): boolean {
    if (a.id && b.id) return a.id === b.id;
    return a.code === b.code;
  }

  isSelected(item: Country | Player): boolean {
    const cur = this.getCurrentWinner();
    if (!cur) return false;
    if (this.activeCategory.type === 'country') {
      return this.sameCountry(cur as Country, item as Country);
    }
    return (cur as Player).id === (item as Player).id;
  }

  toggleSelection(item: Country | Player): void {
    const key = this.activeCategory.id;
    if (key === 'champion') {
      const country = item as Country;
      const cur = this.winners.champion;
      if (cur && this.sameCountry(cur, country)) {
        this.winners = { ...this.winners, champion: null };
      } else {
        this.winners = { ...this.winners, champion: country };
      }
    } else {
      const player = item as Player;
      const cur = this.winners[key];
      if (cur && (cur as Player).id === player.id) {
        this.winners = { ...this.winners, [key]: null };
      } else {
        this.winners = { ...this.winners, [key]: player };
      }
    }
    this.markChanged();
  }

  clearCurrentWinner(): void {
    const key = this.activeCategory.id;
    this.winners = { ...this.winners, [key]: null };
    this.markChanged();
  }

  get hasAnyAwardSelection(): boolean {
    const w = this.winners;
    return !!(
      w.champion ||
      w.goldenBall ||
      w.goldenBoot ||
      w.goldenGlove ||
      w.bestYoungPlayer
    );
  }

  clearAllAwards(): void {
    this.winners = emptyTournamentAwardWinners();
    this.markChanged();
  }

  submit(): void {
    if (!this.selectedTournamentId || !this.editName.trim()) return;
    this.isSaving = true;
    this.saveError = null;
    this.tournamentService
      .patchAdminTournament(this.selectedTournamentId, {
        name: this.editName.trim(),
        status: this.editStatus,
        winners: this.winners
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.hasChanges = false;
        },
        error: (e: Error) => {
          this.isSaving = false;
          this.saveError = e.message ?? 'Error al guardar';
        }
      });
  }

  asCountry(item: Country | Player): Country {
    return item as Country;
  }

  asPlayer(item: Country | Player): Player {
    return item as Player;
  }
}
