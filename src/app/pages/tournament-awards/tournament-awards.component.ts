import { Component, OnInit, Inject, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import {
  Tournament,
  Country,
  Player,
  TournamentAwardPrediction,
  TournamentAwardWinners,
  MemberAwardPrediction,
  TournamentStandings,
  isYoungPlayerAwardEligible
} from '../../models/tournament.model';
import { WORLD_CUP_ID } from '../../services/match.service';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';

interface AwardCategory {
  id: keyof TournamentAwardPrediction;
  title: string;
  description: string;
  maxSelections: number;
  type: 'country' | 'player';
}

@Component({
  selector: 'app-tournament-awards',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './tournament-awards.component.html',
  styleUrl: './tournament-awards.component.scss'
})
export class TournamentAwardsComponent implements OnInit, AfterViewInit {
  username: string = 'Usuario';
  tournament: Tournament | null = null;
  tournamentId: string = '';
  apiTournamentId: string = WORLD_CUP_ID;
  isLoading: boolean = true;
  isSaving: boolean = false;

  /** From GET group: tournament has started — award picks locked */
  get awardsLocked(): boolean {
    return this.tournament?.hasStarted === true;
  }

  get canEdit(): boolean {
    return !this.awardsLocked;
  }

  browseGroupOpen: boolean = false;
  browseLayout: 'per-member' | 'per-award' = 'per-award';
  membersAwardPredictions: MemberAwardPrediction[] = [];
  selectedMemberId: string | null = null;

  @ViewChild('memberChipsScroll') memberChipsScroll?: ElementRef<HTMLElement>;

  memberChipsScrollOverflow = false;
  memberChipsCanScrollPrev = false;
  memberChipsCanScrollNext = false;

  countries: Country[] = [];
  allPlayers: Player[] = [];
  countryFilterCode: string = '';

  predictions: TournamentAwardPrediction = {
    champion: [],
    goldenBall: [],
    goldenBoot: [],
    goldenGlove: [],
    bestYoungPlayer: []
  };

  categories: AwardCategory[] = [
    { id: 'champion', title: 'Campeón', description: 'Selecciona hasta 2 posibles campeones', maxSelections: 2, type: 'country' },
    { id: 'goldenBall', title: 'Balón de Oro', description: 'Mejor jugador del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'goldenBoot', title: 'Bota de Oro', description: 'Máximo goleador del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'goldenGlove', title: 'Guante de Oro', description: 'Mejor portero del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'bestYoungPlayer', title: 'Mejor Juvenil', description: 'Mejor jugador sub-21 (hasta 3)', maxSelections: 3, type: 'player' }
  ];

  activeCategory: AwardCategory = this.categories[0];
  searchTerm: string = '';
  hasChanges: boolean = false;

  /** True award winners from the API; null until published */
  trueWinners: TournamentAwardWinners | null = null;

  /** From router state: abrir vista de predicciones del grupo al cargar (torneo iniciado) */
  private openBrowseFromRoute = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  ngAfterViewInit(): void {
    this.scheduleMemberChipsScrollUpdate();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleMemberChipsScrollUpdate();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.tournamentId = params['id'];
      const st = history.state as {
        username?: string;
        openGroupAwardsBrowse?: boolean;
      } | undefined;
      if (st?.username) {
        this.username = st.username;
        this.tournamentService.setCurrentUser(this.username);
      }
      this.openBrowseFromRoute = st?.openGroupAwardsBrowse === true;
      this.loadData();
    });
  }

  get countryFilterOptions(): Country[] {
    const byCode = new Map<string, Country>();
    for (const p of this.allPlayers) {
      const c = p.country;
      if (!byCode.has(c.code)) {
        byCode.set(c.code, c);
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  get viewPredictions(): TournamentAwardPrediction {
    if (this.awardsLocked && this.browseGroupOpen && this.browseLayout === 'per-member' && this.selectedMemberId) {
      const m = this.membersAwardPredictions.find(x => x.userId === this.selectedMemberId);
      if (m) return m.predictions;
    }
    return this.predictions;
  }

  /** Ver predicciones del grupo: una sola columna, todos los premios del miembro (sin menú lateral) */
  get showAllAwardsForSelectedMember(): boolean {
    return (
      this.awardsLocked &&
      this.browseGroupOpen &&
      this.browseLayout === 'per-member' &&
      this.selectedMemberId != null
    );
  }

  private cloneAwardPredictions(src: TournamentAwardPrediction): TournamentAwardPrediction {
    return {
      champion: [...src.champion],
      goldenBall: [...src.goldenBall],
      goldenBoot: [...src.goldenBoot],
      goldenGlove: [...src.goldenGlove],
      bestYoungPlayer: [...src.bestYoungPlayer]
    };
  }

  private reconcileMembersWithStandings(
    me: TournamentAwardPrediction,
    others: TournamentAwardPrediction[],
    standings: TournamentStandings | null
  ): MemberAwardPrediction[] {
    const mePlayer = standings?.players.find(p => p.id === standings.currentUserId);
    const meMember: MemberAwardPrediction = {
      userId: standings?.currentUserId ?? 'me',
      username: this.username,
      fullName: mePlayer?.fullName,
      avatarInitials: this.username.substring(0, 2).toUpperCase(),
      predictions: me
    };
    if (!standings) {
      return [
        meMember,
        ...others.map((pred, i) => ({
          userId: `other-${i}`,
          username: `Participante ${i + 1}`,
          avatarInitials: String(i + 1).padStart(2, '0').slice(0, 2),
          predictions: pred
        }))
      ];
    }
    const othersStandings = standings.players
      .filter(p => p.id !== standings.currentUserId)
      .sort((a, b) => a.position - b.position);
    const otherMembers: MemberAwardPrediction[] = others.map((pred, i) => {
      const st = othersStandings[i];
      return {
        userId: st?.id ?? `other-${i}`,
        username: st?.username ?? `Participante ${i + 1}`,
        fullName: st?.fullName,
        avatarInitials: st?.avatarInitials ?? '··',
        predictions: pred
      };
    });
    return [meMember, ...otherMembers];
  }

  memberLabel(m: MemberAwardPrediction): string {
    return this.memberDisplay.displayName(m.username, m.fullName);
  }

   loadData(): void {
    this.isLoading = true;

    this.tournamentService.getTournamentById(this.tournamentId).subscribe(tournament => {
      this.tournament = tournament;
      this.apiTournamentId = tournament?.tournamentId ?? WORLD_CUP_ID;

      if (tournament?.hasStarted) {
        this.tournamentService.getGroupAwardPredictions(this.tournamentId).subscribe({
          next: ({ members, awards, standings, trueWinners }) => {
            this.countries = [];
            this.allPlayers = [];
            this.predictions = this.cloneAwardPredictions(awards.me);
            this.hasChanges = false;
            this.trueWinners = trueWinners ?? null;
            this.membersAwardPredictions =
              members.length > 0
                ? members
                : this.reconcileMembersWithStandings(awards.me, awards.others, standings);
            this.selectedMemberId = this.membersAwardPredictions[0]?.userId ?? null;
            this.finishLoadAfterAwards();
          },
          error: () => {
            this.isLoading = false;
          }
        });
      } else {
        forkJoin({
          countries: this.tournamentService.getCountriesForAwards(this.apiTournamentId),
          allPlayers: this.tournamentService.getTournamentPlayersForAwards(this.apiTournamentId),
          awardsMe: this.tournamentService.getMyAwardPredictions(this.tournamentId)
        }).subscribe({
          next: ({ countries, allPlayers, awardsMe }) => {
            this.countries = countries;
            this.allPlayers = allPlayers;
            this.predictions = this.cloneAwardPredictions(awardsMe);
            this.hasChanges = false;
            this.membersAwardPredictions = [];
            this.selectedMemberId = null;
            this.finishLoadAfterAwards();
          },
          error: () => {
            this.isLoading = false;
          }
        });
      }
    });
  }

  private finishLoadAfterAwards(): void {
    this.isLoading = false;
    if (this.openBrowseFromRoute && this.awardsLocked) {
      this.openBrowseFromRoute = false;
      this.openGroupBrowse();
    } else {
      setTimeout(() => this.scheduleMemberChipsScrollUpdate(), 0);
    }
  }

  openGroupBrowse(): void {
    this.browseGroupOpen = true;
    if (!this.selectedMemberId && this.membersAwardPredictions.length) {
      this.selectedMemberId = this.membersAwardPredictions[0].userId;
    }
    setTimeout(() => this.scheduleMemberChipsScrollUpdate(), 0);
  }

  closeGroupBrowse(): void {
    this.router.navigate(['/tournament', this.tournamentId], {
      state: { username: this.username, activeTab: 'standings' as const }
    });
  }

  setBrowseLayout(layout: 'per-member' | 'per-award'): void {
    this.browseLayout = layout;
    if (layout === 'per-member') {
      setTimeout(() => this.scheduleMemberChipsScrollUpdate(), 0);
    }
  }

  setSelectedMember(userId: string): void {
    this.selectedMemberId = userId;
  }

  getSelectionsSectionTitle(): string {
    return 'Candidatos';
  }

  getWinnerForCategoryId(category: AwardCategory): Country | Player | null {
    if (!this.trueWinners) return null;
    return this.trueWinners[category.id] ?? null;
  }

  getWinnerForCategory(): Country | Player | null {
    return this.getWinnerForCategoryId(this.activeCategory);
  }

  getSelectionsForCategory(category: AwardCategory): (Country | Player)[] {
    return this.viewPredictions[category.id] as (Country | Player)[];
  }

  isWinnerItem(item: Country | Player): boolean {
    return this.isWinnerItemInCategory(item, this.activeCategory);
  }

  isWinnerItemInCategory(item: Country | Player, category: AwardCategory): boolean {
    const winner = this.getWinnerForCategoryId(category);
    if (!winner) return false;
    return (winner as Country | Player).id === item.id;
  }

  onMemberChipsScroll(): void {
    this.updateMemberChipsScrollState();
  }

  scrollMemberChips(direction: -1 | 1): void {
    const el = this.memberChipsScroll?.nativeElement;
    if (!el) return;
    const step = Math.min(Math.floor(el.clientWidth * 0.85), 320);
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
    setTimeout(() => this.updateMemberChipsScrollState(), 400);
  }

  private scheduleMemberChipsScrollUpdate(): void {
    void requestAnimationFrame(() => {
      requestAnimationFrame(() => this.updateMemberChipsScrollState());
    });
  }

  private updateMemberChipsScrollState(): void {
    const el = this.memberChipsScroll?.nativeElement;
    if (!el) {
      this.memberChipsScrollOverflow = false;
      this.memberChipsCanScrollPrev = false;
      this.memberChipsCanScrollNext = false;
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    this.memberChipsScrollOverflow = scrollWidth > clientWidth + 1;
    this.memberChipsCanScrollPrev = scrollLeft > 2;
    this.memberChipsCanScrollNext = scrollLeft + clientWidth < scrollWidth - 2;
  }

  getMemberCategorySelections(member: MemberAwardPrediction, cat: AwardCategory): (Country | Player)[] {
    return member.predictions[cat.id] as (Country | Player)[];
  }

  get activeCategoryIndex(): number {
    return this.categories.findIndex(c => c.id === this.activeCategory.id);
  }

  canGoToPreviousCategory(): boolean {
    return this.categories.length > 1;
  }

  canGoToNextCategory(): boolean {
    return this.categories.length > 1;
  }

  goToPreviousCategory(): void {
    if (this.categories.length < 2) return;
    const i = this.activeCategoryIndex;
    const n = this.categories.length;
    if (i <= 0) {
      this.setActiveCategory(this.categories[n - 1]);
    } else {
      this.setActiveCategory(this.categories[i - 1]);
    }
  }

  goToNextCategory(): void {
    if (this.categories.length < 2) return;
    const i = this.activeCategoryIndex;
    const n = this.categories.length;
    if (i < 0) {
      this.setActiveCategory(this.categories[0]);
      return;
    }
    if (i >= n - 1) {
      this.setActiveCategory(this.categories[0]);
    } else {
      this.setActiveCategory(this.categories[i + 1]);
    }
  }

  setActiveCategory(category: AwardCategory): void {
    this.activeCategory = category;
    this.searchTerm = '';
    if (category.type !== 'player') {
      this.countryFilterCode = '';
    }
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
    if (this.activeCategory.id === 'champion') {
      return this.countries;
    }
    return this.playersForActiveCategory();
  }

  getFilteredOptions(): (Country | Player)[] {
    let options = this.getOptionsForCategory();
    if (this.activeCategory.type === 'player' && this.countryFilterCode) {
      options = options.filter(o => (o as Player).country.code === this.countryFilterCode);
    }
    if (!this.searchTerm) return options;

    const term = this.searchTerm.toLowerCase();
    return options.filter(opt => {
      if (this.activeCategory.type === 'country') {
        return (opt as Country).name.toLowerCase().includes(term);
      } else {
        const player = opt as Player;
        return (
          player.name.toLowerCase().includes(term) ||
          player.country.name.toLowerCase().includes(term)
        );
      }
    });
  }

  /** Empty grid copy: reflect country filter and/or search, not only searchTerm */
  getNoResultsMessage(): string {
    const term = this.searchTerm.trim();
    const countryName =
      this.activeCategory.type === 'player' && this.countryFilterCode
        ? this.countryFilterOptions.find(c => c.code === this.countryFilterCode)?.name ??
          this.countryFilterCode
        : '';

    if (countryName && term) {
      return `No se encontraron resultados para "${term}" en ${countryName}`;
    }
    if (countryName) {
      return `No se encontraron resultados para ${countryName}`;
    }
    if (term) {
      return `No se encontraron resultados para "${term}"`;
    }
    return 'No se encontraron resultados';
  }

  sameCountry(a: Country, b: Country): boolean {
    if (a.id && b.id) return a.id === b.id;
    return a.code === b.code;
  }

  isSelected(item: Country | Player): boolean {
    const selections = this.viewPredictions[this.activeCategory.id];
    if (this.activeCategory.type === 'country') {
      return (selections as Country[]).some(s => this.sameCountry(s, item as Country));
    }
    return (selections as Player[]).some(s => s.id === (item as Player).id);
  }

  canSelect(): boolean {
    if (!this.canEdit) return false;
    const selections = this.predictions[this.activeCategory.id];
    return selections.length < this.activeCategory.maxSelections;
  }

  toggleSelection(item: Country | Player): void {
    if (!this.canEdit) return;
    const categoryId = this.activeCategory.id;

    if (this.activeCategory.type === 'country') {
      const country = item as Country;
      const selections = this.predictions[categoryId] as Country[];
      const index = selections.findIndex(s => this.sameCountry(s, country));

      if (index >= 0) {
        selections.splice(index, 1);
      } else if (selections.length < this.activeCategory.maxSelections) {
        selections.push(country);
      }
    } else {
      const player = item as Player;
      const selections = this.predictions[categoryId] as Player[];
      const index = selections.findIndex(s => s.id === player.id);

      if (index >= 0) {
        selections.splice(index, 1);
      } else if (selections.length < this.activeCategory.maxSelections) {
        selections.push(player);
      }
    }

    this.hasChanges = true;
  }

  onSelectionItemKeydown(event: KeyboardEvent, item: Country | Player): void {
    if (!this.canEdit) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.removeSelection(item);
    }
  }

  removeSelection(item: Country | Player): void {
    if (!this.canEdit) return;
    const categoryId = this.activeCategory.id;

    if (this.activeCategory.type === 'country') {
      const country = item as Country;
      const selections = this.predictions[categoryId] as Country[];
      const index = selections.findIndex(s => this.sameCountry(s, country));
      if (index >= 0) selections.splice(index, 1);
    } else {
      const player = item as Player;
      const selections = this.predictions[categoryId] as Player[];
      const index = selections.findIndex(s => s.id === player.id);
      if (index >= 0) selections.splice(index, 1);
    }

    this.hasChanges = true;
  }

  getSelectionCount(category: AwardCategory): number {
    if (
      this.awardsLocked &&
      this.browseGroupOpen &&
      this.browseLayout === 'per-award' &&
      this.membersAwardPredictions.length
    ) {
      return this.membersAwardPredictions[0].predictions[category.id].length;
    }
    const src =
      this.awardsLocked &&
      this.browseGroupOpen &&
      this.browseLayout === 'per-member' &&
      this.selectedMemberId
        ? this.membersAwardPredictions.find(m => m.userId === this.selectedMemberId)?.predictions ??
          this.predictions
        : this.predictions;
    return src[category.id].length;
  }

  getCurrentSelections(): (Country | Player)[] {
    return this.viewPredictions[this.activeCategory.id] as (Country | Player)[];
  }

  savePredictions(): void {
    if (!this.canEdit) return;
    this.isSaving = true;

    this.tournamentService.saveAwardPredictions(this.tournamentId, this.predictions).subscribe({
      next: () => {
        this.isSaving = false;
        this.hasChanges = false;
        this.goBack();
      },
      error: () => {
        this.isSaving = false;
      }
    });
  }

  goBack(): void {
    const activeTab = this.awardsLocked ? ('standings' as const) : ('predictions' as const);
    this.router.navigate(['/tournament', this.tournamentId], {
      state: { username: this.username, activeTab }
    });
  }

  asCountry(item: Country | Player): Country {
    return item as Country;
  }

  asPlayer(item: Country | Player): Player {
    return item as Player;
  }
}
