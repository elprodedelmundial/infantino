import { Inject, Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  RemoteConfig,
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  isSupported
} from 'firebase/remote-config';
import { Observable, catchError, from, map, of, switchMap } from 'rxjs';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export interface FeatureFlags {
  allowUsersRegistration: boolean;
  allowNewGroups: boolean;
  allowJoiningGroups: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private static readonly DEFAULT_FLAGS: FeatureFlags = {
    allowUsersRegistration: true,
    allowNewGroups: false,
    allowJoiningGroups: true
  };

  private remoteConfig: RemoteConfig | null = null;

  constructor(@Inject(ENVIRONMENT_CONFIG) private config: EnvironmentConfig) {}

  getFeatureFlags(): Observable<FeatureFlags> {
    if (!this.hasFirebaseRemoteConfig()) {
      return of(FeatureFlagService.DEFAULT_FLAGS);
    }

    return from(isSupported()).pipe(
      switchMap(supported => {
        if (!supported) {
          return of(FeatureFlagService.DEFAULT_FLAGS);
        }

        const remoteConfig = this.getOrCreateRemoteConfig();
        return from(fetchAndActivate(remoteConfig)).pipe(
          map(() => ({
            allowUsersRegistration: getValue(remoteConfig, 'allow_new_users').asBoolean(),
            allowNewGroups: getValue(remoteConfig, 'allow_new_groups').asBoolean(),
            allowJoiningGroups: getValue(remoteConfig, 'allow_joining_groups').asBoolean()
          }))
        );
      }),
      catchError(() => of(FeatureFlagService.DEFAULT_FLAGS))
    );
  }

  isUserRegistrationAllowed(): Observable<boolean> {
    return this.getFeatureFlags().pipe(map(flags => flags.allowUsersRegistration));
  }

  isNewGroupsAllowed(): Observable<boolean> {
    return this.getFeatureFlags().pipe(map(flags => flags.allowNewGroups));
  }

  isJoiningGroupsAllowed(): Observable<boolean> {
    return this.getFeatureFlags().pipe(map(flags => flags.allowJoiningGroups));
  }

  private hasFirebaseRemoteConfig(): boolean {
    return Boolean(
      this.config.firebaseProjectId &&
      this.config.firebaseApiKey &&
      this.config.firebaseAppId
    );
  }

  private getOrCreateRemoteConfig(): RemoteConfig {
    if (this.remoteConfig) {
      return this.remoteConfig;
    }

    const app = this.getOrCreateFirebaseApp();
    this.remoteConfig = getRemoteConfig(app);
    this.remoteConfig.defaultConfig = {
      allow_new_users: FeatureFlagService.DEFAULT_FLAGS.allowUsersRegistration,
      allow_new_groups: FeatureFlagService.DEFAULT_FLAGS.allowNewGroups,
      allow_joining_groups: FeatureFlagService.DEFAULT_FLAGS.allowJoiningGroups
    };
    this.remoteConfig.settings = {
      minimumFetchIntervalMillis: 60_000,
      fetchTimeoutMillis: 10_000
    };

    return this.remoteConfig;
  }

  private getOrCreateFirebaseApp(): FirebaseApp {
    if (getApps().length > 0) {
      return getApp();
    }

    const options: FirebaseOptions = {
      apiKey: this.config.firebaseApiKey,
      appId: this.config.firebaseAppId,
      projectId: this.config.firebaseProjectId
    };

    if (this.config.firebaseMessagingSenderId) {
      options.messagingSenderId = this.config.firebaseMessagingSenderId;
    }

    return initializeApp(options);
  }
}
