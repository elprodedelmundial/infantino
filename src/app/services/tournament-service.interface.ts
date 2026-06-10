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
  GroupAwardPredictionsLoadPayload,
  LiveMatch,
  MatchWithPredictions,
  DashboardLiveData,
  AllPredictionsData,
  AdminTournamentListItem,
  AdminTournamentDetail,
  AdminCreateMatchPayload,
  AdminTournamentMatch,
  AdminUpdateMatchPayload,
  TournamentAwardWinners,
  GroupCandidate
} from '../models/tournament.model';
import { TournamentPredictions } from './match-service.interface';

export interface ITournamentService {
  setCurrentUser(username: string): void;
  getAvailableTournaments(): Observable<Tournament[]>;
  getJoinedTournaments(): Observable<JoinedTournament[]>;
  createGroup(payload: { name: string; maxMembers: number; isPrivate?: boolean }): Observable<string>;
  joinTournament(tournamentId: string): Observable<boolean>;
  leaveTournament(tournamentId: string): Observable<boolean>;
  getTournamentStandings(tournamentId: string, live?: boolean): Observable<TournamentStandings | null>;
  getUserPredictions(tournamentId: string): Observable<UserPredictions>;
  getAllPredictions(tournamentId: string): Observable<AllPredictionsData>;
  updatePrediction(tournamentId: string, matchId: string, newScore: MatchScore): Observable<boolean>;
  updateMultiplePredictions(tournamentId: string, updates: { matchId: string; score: MatchScore }[]): Observable<boolean>;
  getTournamentById(tournamentId: string): Observable<Tournament | null>;
  getCountriesForAwards(tournamentId: string): Observable<Country[]>;
  /** GET /api/tournaments/{id}/players — all players; filter client-side for GK / U21 */
  getTournamentPlayersForAwards(tournamentId: string): Observable<Player[]>;
  /** GET .../predictions/awards/me — current user's award picks */
  getMyAwardPredictions(groupId: string): Observable<TournamentAwardPrediction>;
  /** GET .../predictions/awards — all members (tournament started); includes standings */
  getGroupAwardPredictions(groupId: string): Observable<GroupAwardPredictionsLoadPayload>;
  saveAwardPredictions(groupId: string, predictions: TournamentAwardPrediction): Observable<boolean>;
  getDashboardLiveData(): Observable<DashboardLiveData>;
  getMemberPredictions(matchId: string, tournamentId?: string): Observable<MatchWithPredictions | null>;
  getLiveMatchesForTournament(tournamentId: string): Observable<LiveMatch[]>;
  getJoinedTournamentIds(): string[];
  updateGroup(groupId: string, update: { name?: string; maxMembers?: number; isPrivate?: boolean }): Observable<boolean>;
  getMatchGroupPredictions(groupId: string, matchId: string): Observable<TournamentPredictions | null>;
  getAdminTournaments(): Observable<AdminTournamentListItem[]>;
  getAdminTournamentDetail(tournamentId: string): Observable<AdminTournamentDetail | null>;
  patchAdminTournament(
    tournamentId: string,
    payload: { name: string; status: string; winners: TournamentAwardWinners }
  ): Observable<boolean>;
  createAdminMatches(tournamentId: string, payload: AdminCreateMatchPayload[]): Observable<boolean>;
  /** GET all matches (past + live + next) for the given tournament — used by the admin update screen */
  getAdminTournamentMatches(tournamentId: string): Observable<AdminTournamentMatch[]>;
  /** PUT /api/tournaments/{id}/matches — bulk-update matches */
  updateAdminMatches(tournamentId: string, payload: AdminUpdateMatchPayload[]): Observable<boolean>;
  /** GET group by ID and extract candidates array */
  getCandidates(groupId: string): Observable<GroupCandidate[]>;
  /** PUT accept a candidate into the group */
  acceptCandidate(groupId: string, candidateId: string): Observable<boolean>;
  /** DELETE reject a candidate from the group */
  rejectCandidate(groupId: string, candidateId: string): Observable<boolean>;
  /** DELETE kick (remove) an existing member from the group */
  kickMember(groupId: string, memberId: string): Observable<boolean>;
}

export const TOURNAMENT_SERVICE = 'TOURNAMENT_SERVICE';
