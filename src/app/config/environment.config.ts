import { InjectionToken } from '@angular/core';

export interface EnvironmentConfig {
  grondonaUrl: string;
  firebaseProjectId: string;
  firebaseApiKey: string;
  firebaseAppId: string;
  firebaseMessagingSenderId: string;
}

export const ENVIRONMENT_CONFIG = new InjectionToken<EnvironmentConfig>('ENVIRONMENT_CONFIG');

// Load configuration from window object (can be set at runtime)
export function loadEnvironmentConfig(): EnvironmentConfig {
  const windowConfig = (window as any).__APP_CONFIG__;
  
  return {
    grondonaUrl: windowConfig?.['grondona-url'] || 'http://localhost:8080',
    firebaseProjectId: windowConfig?.['firebase-project-id'] || 'elprodedelmundial-7d579',
    firebaseApiKey: windowConfig?.['firebase-api-key'] || '',
    firebaseAppId: windowConfig?.['firebase-app-id'] || '',
    firebaseMessagingSenderId: windowConfig?.['firebase-messaging-sender-id'] || '',
  };
}

export const environmentConfig: EnvironmentConfig = loadEnvironmentConfig();
