export interface Tournament {
  id: string;
  name: string;
  participantsCount: number;
  maxParticipants: number;
  startDate: Date;
  isJoined?: boolean;
}

export interface JoinedTournament {
  tournament: Tournament;
  userRanking: number | null;
  userPoints: number;
}

export type PredictionResult = 'correct' | 'incorrect' | 'half';

export interface TournamentPlayer {
  id: string;
  username: string;
  position: number;
  points: number;
  lastPredictions: PredictionResult[];
  avatarInitials: string;
}

export interface TournamentStandings {
  tournament: Tournament;
  players: TournamentPlayer[];
  currentUserId: string;
}

export interface Country {
  code: string;
  name: string;
  flagUrl: string;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export type TournamentStage = 
  | 'group_stage'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final';

export interface TournamentStageInfo {
  id: TournamentStage;
  name: string;
  order: number;
  hasStarted: boolean;
  matchCount: number;
}

export interface MatchPrediction {
  id: string;
  matchCode: string;
  homeTeam: Country;
  awayTeam: Country;
  predictedScore: MatchScore;
  actualScore?: MatchScore;
  isPlayed: boolean;
  matchDate: Date;
  result?: PredictionResult;
  stage: TournamentStage;
  group?: string;
  odds?: MatchOdds;
}

export interface UserPredictions {
  pastPredictions: MatchPrediction[];
  upcomingPredictions: MatchPrediction[];
}

export interface AllPredictionsData {
  matches: MatchPrediction[];
  stages: TournamentStageInfo[];
}

export type PredictionFilter = 'all' | 'future';

// Tournament Awards
export interface Player {
  id: string;
  name: string;
  country: Country;
  position: string;
  imageUrl?: string;
}

export interface TournamentAwardPrediction {
  champion: Country[];  // 2 allowed
  goldenBall: Player[];  // 3 allowed (Balón de Oro)
  goldenBoot: Player[];  // 3 allowed (Bota de Oro)
  goldenGlove: Player[];  // 3 allowed (Guante de Oro - best goalkeeper)
  bestYoungPlayer: Player[];  // 3 allowed (Mejor Jugador Joven)
}

export interface AwardOption {
  id: string;
  type: 'country' | 'player';
  data: Country | Player;
}

// Live Matches
export type MatchStatus = 'live' | 'upcoming' | 'finished';

export interface LiveMatch {
  id: string;
  matchCode: string;
  homeTeam: Country;
  awayTeam: Country;
  currentScore?: MatchScore;
  matchTime?: string; // e.g., "45'+2" or "HT" or "78'"
  matchDate: Date;
  status: MatchStatus;
  stage: TournamentStage;
  group?: string;
  odds?: MatchOdds;
  userPrediction?: MatchScore;
  tournamentIds: string[]; // Which tournaments this match is relevant to
}

// Member Predictions
export interface MemberPrediction {
  oddsId: string;
  username: string;
  avatarInitials: string;
  predictedScore: MatchScore;
  isCurrentUser: boolean;
}

export interface MatchWithPredictions {
  match: LiveMatch;
  memberPredictions: MemberPrediction[];
  totalPredictions: number;
}

// Dashboard Live Section
export interface DashboardLiveData {
  liveMatches: LiveMatch[];
  upcomingMatches: LiveMatch[];
}
