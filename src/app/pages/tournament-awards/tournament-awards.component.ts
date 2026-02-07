import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { 
  Tournament,
  Country,
  Player,
  TournamentAwardPrediction
} from '../../models/tournament.model';

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
export class TournamentAwardsComponent implements OnInit {
  username: string = 'Usuario';
  tournament: Tournament | null = null;
  tournamentId: string = '';
  isLoading: boolean = true;
  isSaving: boolean = false;
  
  // Data
  countries: Country[] = [];
  players: Player[] = [];
  goalkeepers: Player[] = [];
  youngPlayers: Player[] = [];
  
  // Current predictions
  predictions: TournamentAwardPrediction = {
    champion: [],
    goldenBall: [],
    goldenBoot: [],
    goldenGlove: [],
    bestYoungPlayer: []
  };
  
  // Categories configuration
  categories: AwardCategory[] = [
    { id: 'champion', title: 'Campeón', description: 'Selecciona hasta 2 posibles campeones', maxSelections: 2, type: 'country' },
    { id: 'goldenBall', title: 'Balón de Oro', description: 'Mejor jugador del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'goldenBoot', title: 'Bota de Oro', description: 'Máximo goleador del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'goldenGlove', title: 'Guante de Oro', description: 'Mejor portero del torneo (hasta 3)', maxSelections: 3, type: 'player' },
    { id: 'bestYoungPlayer', title: 'Mejor Jugador Joven', description: 'Mejor jugador sub-23 (hasta 3)', maxSelections: 3, type: 'player' }
  ];
  
  activeCategory: AwardCategory = this.categories[0];
  searchTerm: string = '';
  hasChanges: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }

    this.route.params.subscribe(params => {
      this.tournamentId = params['id'];
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;

    this.tournamentService.getTournamentById(this.tournamentId).subscribe(tournament => {
      this.tournament = tournament;

      // Load countries
      this.tournamentService.getCountriesForAwards().subscribe(countries => {
        this.countries = countries;
      });

      // Load players
      this.tournamentService.getPlayersForAwards().subscribe(players => {
        this.players = players;
      });

      // Load goalkeepers
      this.tournamentService.getGoalkeepersForAwards().subscribe(goalkeepers => {
        this.goalkeepers = goalkeepers;
      });

      // Load young players
      this.tournamentService.getYoungPlayersForAwards().subscribe(youngPlayers => {
        this.youngPlayers = youngPlayers;
      });

      // Load existing predictions
      this.tournamentService.getUserAwardPredictions(this.tournamentId).subscribe(predictions => {
        if (predictions) {
          this.predictions = predictions;
        }
        this.isLoading = false;
      });
    });
  }

  setActiveCategory(category: AwardCategory): void {
    this.activeCategory = category;
    this.searchTerm = '';
  }

  getOptionsForCategory(): (Country | Player)[] {
    switch (this.activeCategory.id) {
      case 'champion':
        return this.countries;
      case 'goldenGlove':
        return this.goalkeepers;
      case 'bestYoungPlayer':
        return this.youngPlayers;
      default:
        return this.players;
    }
  }

  getFilteredOptions(): (Country | Player)[] {
    const options = this.getOptionsForCategory();
    if (!this.searchTerm) return options;

    const term = this.searchTerm.toLowerCase();
    return options.filter(opt => {
      if (this.activeCategory.type === 'country') {
        return (opt as Country).name.toLowerCase().includes(term);
      } else {
        const player = opt as Player;
        return player.name.toLowerCase().includes(term) || 
               player.country.name.toLowerCase().includes(term);
      }
    });
  }

  isSelected(item: Country | Player): boolean {
    const selections = this.predictions[this.activeCategory.id];
    if (this.activeCategory.type === 'country') {
      return (selections as Country[]).some(s => s.code === (item as Country).code);
    } else {
      return (selections as Player[]).some(s => s.id === (item as Player).id);
    }
  }

  canSelect(): boolean {
    const selections = this.predictions[this.activeCategory.id];
    return selections.length < this.activeCategory.maxSelections;
  }

  toggleSelection(item: Country | Player): void {
    const categoryId = this.activeCategory.id;

    if (this.activeCategory.type === 'country') {
      const country = item as Country;
      const selections = this.predictions[categoryId] as Country[];
      const index = selections.findIndex(s => s.code === country.code);

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

  removeSelection(item: Country | Player): void {
    const categoryId = this.activeCategory.id;

    if (this.activeCategory.type === 'country') {
      const country = item as Country;
      const selections = this.predictions[categoryId] as Country[];
      const index = selections.findIndex(s => s.code === country.code);
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
    return this.predictions[category.id].length;
  }

  getCurrentSelections(): (Country | Player)[] {
    return this.predictions[this.activeCategory.id] as (Country | Player)[];
  }

  savePredictions(): void {
    this.isSaving = true;

    this.tournamentService.saveAwardPredictions(this.tournamentId, this.predictions).subscribe(() => {
      this.isSaving = false;
      this.hasChanges = false;
      this.goBack();
    });
  }

  goBack(): void {
    this.router.navigate(['/tournament', this.tournamentId], {
      state: { username: this.username }
    });
  }

  asCountry(item: Country | Player): Country {
    return item as Country;
  }

  asPlayer(item: Country | Player): Player {
    return item as Player;
  }
}
