import { Observable } from 'rxjs';
import { 
  Tournament, 
  JoinedTournament, 
  TournamentStandings, 
  UserPredictions,
  MatchScore,
  Country,
  Player,
  TournamentAwardPrediction,
  LiveMatch,
  MatchWithPredictions,
  DashboardLiveData,
  AllPredictionsData
} from '../models/tournament.model';
import { TournamentPredictions } from './match-service.interface';

export interface ITournamentService {
  setCurrentUser(username: string): void;
  getAvailableTournaments(): Observable<Tournament[]>;
  getJoinedTournaments(): Observable<JoinedTournament[]>;
  joinTournament(tournamentId: string): Observable<boolean>;
  leaveTournament(tournamentId: string): Observable<boolean>;
  getTournamentStandings(tournamentId: string): Observable<TournamentStandings | null>;
  getUserPredictions(tournamentId: string): Observable<UserPredictions>;
  getAllPredictions(tournamentId: string): Observable<AllPredictionsData>;
  updatePrediction(tournamentId: string, matchId: string, newScore: MatchScore): Observable<boolean>;
  updateMultiplePredictions(tournamentId: string, updates: { matchId: string; score: MatchScore }[]): Observable<boolean>;
  getTournamentById(tournamentId: string): Observable<Tournament | null>;
  getCountriesForAwards(): Observable<Country[]>;
  getPlayersForAwards(): Observable<Player[]>;
  getGoalkeepersForAwards(): Observable<Player[]>;
  getYoungPlayersForAwards(): Observable<Player[]>;
  getUserAwardPredictions(tournamentId: string): Observable<TournamentAwardPrediction | null>;
  saveAwardPredictions(tournamentId: string, predictions: TournamentAwardPrediction): Observable<boolean>;
  getDashboardLiveData(): Observable<DashboardLiveData>;
  getMemberPredictions(matchId: string, tournamentId?: string): Observable<MatchWithPredictions | null>;
  getLiveMatchesForTournament(tournamentId: string): Observable<LiveMatch[]>;
  getJoinedTournamentIds(): string[];
  updateGroup(groupId: string, update: { name?: string; maxMembers?: number; isPrivate?: boolean }): Observable<boolean>;
  getMatchGroupPredictions(groupId: string, matchId: string): Observable<TournamentPredictions | null>;
}

export const TOURNAMENT_SERVICE = 'TOURNAMENT_SERVICE';
