import { InjectionToken } from '@angular/core';

export interface EnvironmentConfig {
  grondonaUrl: string;
  mockedUserService: boolean;
  mockedTournamentService: boolean;
  mockedMatchService: boolean;
}

export const ENVIRONMENT_CONFIG = new InjectionToken<EnvironmentConfig>('ENVIRONMENT_CONFIG');

// Load configuration from window object (can be set at runtime)
export function loadEnvironmentConfig(): EnvironmentConfig {
  // Check for runtime configuration set via window object
  // This allows the URL to be configured at deployment time
  const windowConfig = (window as any).__APP_CONFIG__;
  
  return {
    grondonaUrl: windowConfig?.['grondona-url'] || 'http://localhost:8080',
    mockedUserService: false,
    mockedTournamentService: false,
    mockedMatchService: true
  };
}

export const environmentConfig: EnvironmentConfig = loadEnvironmentConfig();
