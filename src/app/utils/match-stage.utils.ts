import { StageFilterId, TournamentStage, TournamentStageInfo } from '../models/tournament.model';

/** grondona MatchStage enum (openapi MatchResponse.stage) */
export type MatchStageApi =
  | 'GROUP_STAGE'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTERFINALS'
  | 'SEMIFINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

/** grondona MatchGroup enum (openapi MatchResponse.group) */
export type MatchGroupApi =
  | 'GROUP_A'
  | 'GROUP_B'
  | 'GROUP_C'
  | 'GROUP_D'
  | 'GROUP_E'
  | 'GROUP_F'
  | 'GROUP_G'
  | 'GROUP_H'
  | 'GROUP_I'
  | 'GROUP_J'
  | 'GROUP_K'
  | 'GROUP_L';

const API_STAGE_TO_TOURNAMENT: Record<MatchStageApi, TournamentStage> = {
  GROUP_STAGE: 'group_stage',
  ROUND_OF_32: 'round_of_32',
  ROUND_OF_16: 'round_of_16',
  QUARTERFINALS: 'quarter_finals',
  SEMIFINALS: 'semi_finals',
  THIRD_PLACE: 'third_place',
  FINAL: 'final',
};

const API_GROUP_TO_LETTER: Record<MatchGroupApi, string> = {
  GROUP_A: 'A',
  GROUP_B: 'B',
  GROUP_C: 'C',
  GROUP_D: 'D',
  GROUP_E: 'E',
  GROUP_F: 'F',
  GROUP_G: 'G',
  GROUP_H: 'H',
  GROUP_I: 'I',
  GROUP_J: 'J',
  GROUP_K: 'K',
  GROUP_L: 'L',
};

/** Match stages grouped under the "Ronda Final" filter. */
export const FINAL_ROUND_MATCH_STAGES: readonly TournamentStage[] = ['third_place', 'final'];

export function mapApiStageToTournamentStage(stage: string): TournamentStage {
  return API_STAGE_TO_TOURNAMENT[stage as MatchStageApi] ?? 'group_stage';
}

export function mapApiGroupToGroupLetter(group: string): string {
  return API_GROUP_TO_LETTER[group as MatchGroupApi] ?? group.replace(/^GROUP_/, '');
}

export function matchBelongsToStageFilter(
  matchStage: TournamentStage,
  filterId: StageFilterId | 'all'
): boolean {
  if (filterId === 'all') {
    return true;
  }
  if (filterId === 'final_round') {
    return FINAL_ROUND_MATCH_STAGES.includes(matchStage);
  }
  return matchStage === filterId;
}

export const TOURNAMENT_STAGE_NAMES: Record<TournamentStage, string> = {
  group_stage: 'Fase de Grupos',
  round_of_32: 'Dieciseisavos de Final',
  round_of_16: 'Octavos de Final',
  quarter_finals: 'Cuartos de Final',
  semi_finals: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
};

export const ALL_STAGE_INFOS: TournamentStageInfo[] = [
  { id: 'group_stage',    name: 'Fase de Grupos',          order: 1, hasStarted: false, matchCount: 0 },
  { id: 'round_of_32',    name: 'Dieciseisavos de Final',  order: 2, hasStarted: false, matchCount: 0 },
  { id: 'round_of_16',    name: 'Octavos de Final',        order: 3, hasStarted: false, matchCount: 0 },
  { id: 'quarter_finals', name: 'Cuartos de Final',        order: 4, hasStarted: false, matchCount: 0 },
  { id: 'semi_finals',    name: 'Semifinales',             order: 5, hasStarted: false, matchCount: 0 },
  { id: 'final_round',    name: 'Ronda Final',             order: 6, hasStarted: false, matchCount: 0 },
];

export const MATCH_STAGE_API_OPTIONS: ReadonlyArray<{ value: MatchStageApi; label: string }> = [
  { value: 'GROUP_STAGE', label: 'Fase de Grupos' },
  { value: 'ROUND_OF_32', label: 'Dieciseisavos de Final' },
  { value: 'ROUND_OF_16', label: 'Octavos de Final' },
  { value: 'QUARTERFINALS', label: 'Cuartos de Final' },
  { value: 'SEMIFINALS', label: 'Semifinales' },
  { value: 'THIRD_PLACE', label: 'Tercer Puesto' },
  { value: 'FINAL', label: 'Final' },
];

export const MATCH_GROUP_API_OPTIONS: ReadonlyArray<{ value: MatchGroupApi; label: string }> = [
  { value: 'GROUP_A', label: 'Grupo A' },
  { value: 'GROUP_B', label: 'Grupo B' },
  { value: 'GROUP_C', label: 'Grupo C' },
  { value: 'GROUP_D', label: 'Grupo D' },
  { value: 'GROUP_E', label: 'Grupo E' },
  { value: 'GROUP_F', label: 'Grupo F' },
  { value: 'GROUP_G', label: 'Grupo G' },
  { value: 'GROUP_H', label: 'Grupo H' },
  { value: 'GROUP_I', label: 'Grupo I' },
  { value: 'GROUP_J', label: 'Grupo J' },
  { value: 'GROUP_K', label: 'Grupo K' },
  { value: 'GROUP_L', label: 'Grupo L' },
];

export function getMatchStageApiLabel(stage: MatchStageApi): string {
  return MATCH_STAGE_API_OPTIONS.find(option => option.value === stage)?.label ?? stage;
}

export function getMatchGroupApiLabel(group: MatchGroupApi): string {
  return MATCH_GROUP_API_OPTIONS.find(option => option.value === group)?.label ?? group;
}
