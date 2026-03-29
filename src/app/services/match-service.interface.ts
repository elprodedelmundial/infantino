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

export interface IMatchService {
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
