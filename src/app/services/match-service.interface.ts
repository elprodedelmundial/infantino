import { Observable } from 'rxjs';
import { 
  LiveMatch,
  MatchScore
} from '../models/tournament.model';

export interface TournamentPredictions {
  tournamentId: string;
  tournamentName: string;
  predictions: import('../models/tournament.model').MemberPrediction[];
}

export interface MatchPredictionsByTournament {
  match: LiveMatch;
  tournamentPredictions: TournamentPredictions[];
}

/** From GET /api/tournaments/{id}/matches — includes total_* fields from API. */
export interface TournamentMatchListsPayload {
  liveMatches: LiveMatch[];
  upcomingMatches: LiveMatch[];
  pastMatches: LiveMatch[];
  totalPastMatches: number;
  totalLiveMatches: number;
  totalNextMatches: number;
}

export interface IMatchService {
  /** Default window: next=5, past=10; uses cache until clearCache. */
  getTournamentMatchLists(): Observable<TournamentMatchListsPayload>;
  /** Same as initial request but without `past` — returns all finished matches. */
  loadAllPastTournamentMatchLists(): Observable<TournamentMatchListsPayload>;
  getLiveMatches(): Observable<LiveMatch[]>;
  getUpcomingMatches(): Observable<LiveMatch[]>;
  getPastMatches(): Observable<LiveMatch[]>;
  getMatchById(matchId: string): Observable<LiveMatch | null>;
  getMatchPredictionsByTournament(
    matchId: string, 
    joinedTournaments: { id: string; name: string }[],
    currentUsername: string
  ): Observable<MatchPredictionsByTournament | null>;
  getUserPredictionForMatch(matchId: string, tournamentId: string): Observable<MatchScore | null>;
  clearCache(): void;
}

export const MATCH_SERVICE = 'MATCH_SERVICE';
