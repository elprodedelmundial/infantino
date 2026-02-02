import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ResultsComponent } from './pages/results/results.component';
import { MyTournamentsComponent } from './pages/my-tournaments/my-tournaments.component';
import { TournamentSearchComponent } from './pages/tournament-search/tournament-search.component';
import { TournamentStandingsComponent } from './pages/tournament-standings/tournament-standings.component';
import { PredictionsEditComponent } from './pages/predictions-edit/predictions-edit.component';
import { ProfileEditComponent } from './pages/profile-edit/profile-edit.component';
import { TournamentAwardsComponent } from './pages/tournament-awards/tournament-awards.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'results', component: ResultsComponent },
  { path: 'my-tournaments', component: MyTournamentsComponent },
  { path: 'profile', component: ProfileEditComponent },
  { path: 'tournaments', component: TournamentSearchComponent },
  { path: 'tournament/:id', component: TournamentStandingsComponent },
  { path: 'tournament/:id/edit', component: PredictionsEditComponent },
  { path: 'tournament/:id/awards', component: TournamentAwardsComponent },
  { path: '**', redirectTo: '' }
];
