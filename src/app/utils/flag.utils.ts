import { Country } from '../models/tournament.model';

/** Switzerland — use with `.flag.flag--ch` so the flag keeps a square aspect. */
export function isSwitzerland(team: Pick<Country, 'code'> | undefined | null): boolean {
  return (team?.code ?? '').toUpperCase() === 'CH';
}
