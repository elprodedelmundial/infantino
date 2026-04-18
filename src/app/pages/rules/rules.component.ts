import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [UserToolbarComponent],
  templateUrl: './rules.component.html',
  styleUrl: './rules.component.scss'
})
export class RulesComponent {
  username: string = 'Usuario';

  constructor(private router: Router) {
    const st = history.state as { username?: string } | undefined;
    if (st?.username) this.username = st.username;
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], { state: { username: this.username } });
  }
}
