export interface Tournament {
  id: string;
  name: string;
  participantsCount: number;
  maxParticipants: number;
  startDate: Date;
  isJoined?: boolean;
  /** Group requires admin approval to join */
  isPrivate?: boolean;
  /** User requested access and is waiting for approval */
  isPendingApproval?: boolean;
  tournamentId?: string;
  /** From GET group: tournament has started (award picks locked) */
  hasStarted?: boolean;
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'CANDIDATE';

export interface JoinedTournament {
  tournament: Tournament;
  userRanking: number | null;
  userPoints: number;
  role?: GroupRole;
  /** From getMyGroups: total_candidates — pending join requests (admins only, may be null) */
  totalCandidates?: number | null;
}

/** A user pending approval to join a group */
export interface GroupCandidate {
  id: string;
  username: string;
  fullName?: string;
}

/** A group with its pending join-request users (from CurrentUserResponse.join_requests) */
export interface GroupJoinRequest {
  groupId: string;
  groupName: string;
  tournamentId: string;
  users: GroupCandidate[];
}

export type PredictionResult = 'correct' | 'incorrect' | 'half' | 'bonus';

/** One dot in standings "Últimas" — from group standings `last_predictions` entries */
export interface LastStandingPrediction {
  result: PredictionResult;
  /** Bonus multiplier applied to this prediction (API `has_multiplier`) */
  hasMultiplier: boolean;
}

export interface TournamentPlayer {
  id: string;
  username: string;
  /** From GET group standings (same response as username) */
  fullName?: string;
  position: number;
  points: number;
  lastPredictions: LastStandingPrediction[];
  avatarInitials: string;
}

export interface TournamentStandings {
  tournament: Tournament;
  players: TournamentPlayer[];
  currentUserId: string;
}

export interface Country {
  /** Team UUID from API (required when submitting award picks) */
  id?: string;
  code: string;
  name: string;
  flagUrl: string;
}

export type PlayerPositionCode = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD';

export const PLAYER_POSITION_LABELS: Record<PlayerPositionCode, string> = {
  GOALKEEPER: 'Portero',
  DEFENDER: 'Defensa',
  MIDFIELDER: 'Mediocampista',
  FORWARD: 'Delantero'
};

/** Same birthdate floor as backend WorldCupEngine.BEST_YOUNG_PLAYER_DATE_LIMIT */
export const YOUNG_PLAYER_AWARD_BIRTHDATE_MIN = '2005-01-01';

export function isYoungPlayerAwardEligible(birthdate?: string): boolean {
  if (!birthdate) return false;
  const day = birthdate.slice(0, 10);
  return day >= YOUNG_PLAYER_AWARD_BIRTHDATE_MIN;
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
  | 'round_of_32'
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

export type MatchApiStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';

export interface MatchPrediction {
  id: string;
  matchCode: string;
  homeTeam: Country;
  awayTeam: Country;
  predictedScore: MatchScore;
  hasPrediction: boolean;
  actualScore?: MatchScore;
  isPlayed: boolean;
  matchDate: Date;
  result?: PredictionResult;
  stage: TournamentStage;
  group?: string;
  odds?: MatchOdds;
  matchStatus?: MatchApiStatus;
  /** From match payload `has_multiplier` */
  hasMultiplier?: boolean;
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
  /** Localized label (e.g. Portero) */
  position: string;
  positionCode?: PlayerPositionCode;
  birthdate?: string;
  imageUrl?: string;
}

export interface TournamentAwardPrediction {
  champion: Country[];  // 2 allowed — maps to API champions
  goldenBall: Player[];  // 3 — maps to API best_players (Balón de Oro)
  goldenBoot: Player[];  // 3 — maps to API top_scorers (Bota de Oro)
  goldenGlove: Player[];  // 3 — maps to API best_goalkeepers
  bestYoungPlayer: Player[];  // 3 — maps to API best_young_players
}

/** Group member + resolved award picks (browse mode when tournament is locked) */
export interface MemberAwardPrediction {
  userId: string;
  username: string;
  /** From GET group award predictions `user` (same row as username) */
  fullName?: string;
  avatarInitials: string;
  predictions: TournamentAwardPrediction;
}

/** Parsed from GET .../predictions/awards/me or split from group list */
export interface GroupAwardPredictionsResult {
  me: TournamentAwardPrediction;
  others: TournamentAwardPrediction[];
}

/** True award winners from the API `awards` field (null when tournament hasn't concluded) */
export interface TournamentAwardWinners {
  champion: Country | null;
  goldenBall: Player | null;
  goldenBoot: Player | null;
  goldenGlove: Player | null;
  bestYoungPlayer: Player | null;
}

export function emptyTournamentAwardWinners(): TournamentAwardWinners {
  return {
    champion: null,
    goldenBall: null,
    goldenBoot: null,
    goldenGlove: null,
    bestYoungPlayer: null
  };
}

/** Admin: GET /api/tournaments list item */
export interface AdminTournamentListItem {
  id: string;
  name: string;
  status?: string;
}

/** Admin: GET /api/tournaments/{id} normalized for the editor */
export interface AdminTournamentDetail {
  id: string;
  name: string;
  status: string;
  awardWinners: TournamentAwardWinners | null;
}

export interface AdminCreateMatchPayload {
  code: string;
  homeTeamId: string;
  awayTeamId: string;
  startedAt: string;
  hasMultiplier: boolean;
}

/** GET .../predictions/awards (group) + standings in one load */
export interface GroupAwardPredictionsLoadPayload {
  /**
   * From API `predictions[]`: each row includes `user` + award picks (grondona GroupAwardPredictionsResponse).
   * Empty when only legacy `{ me, others }` shape was returned.
   */
  members: MemberAwardPrediction[];
  awards: GroupAwardPredictionsResult;
  standings: TournamentStandings | null;
  /** True winners from the API `awards` field; null when not yet published */
  trueWinners: TournamentAwardWinners | null;
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
  /**
   * Penalty shoot-out score. Only set when the match was decided by penalties
   * (i.e. both `home_penalties` and `away_penalties` are present on the API
   * payload). Rendered underneath the full-time score, e.g. `0 - 0 (5 - 5)`.
   */
  penaltyScore?: MatchScore;
  matchTime?: string; // e.g., "45'+2" or "HT" or "78'"
  matchDate: Date;
  status: MatchStatus;
  stage: TournamentStage;
  group?: string;
  odds?: MatchOdds;
  userPrediction?: MatchScore;
  tournamentIds: string[]; // Which tournaments this match is relevant to
  /** From match payload `has_multiplier` */
  hasMultiplier?: boolean;
}

// Member Predictions
export type PredictionStatus = 'PENDING' | 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'BONUS';

export interface MemberPrediction {
  oddsId: string;
  username: string;
  avatarInitials: string;
  /** From match predictions API user payload when present */
  fullName?: string;
  predictedScore: MatchScore;
  /**
   * Whether this user actually submitted a prediction for the match. When
   * `false`, `predictedScore` is a placeholder (both goals = 0) and the UI
   * should render a blank/"–" value instead of `0 - 0`, so a missing
   * prediction isn't confused with a real 0-0 pick.
   */
  hasPrediction: boolean;
  isCurrentUser: boolean;
  predictionStatus?: PredictionStatus;
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
