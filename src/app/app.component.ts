import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="bg-pattern"></div>
    <div class="grid-overlay"></div>
    <router-outlet></router-outlet>
  `,
  styles: []
})
export class AppComponent {
  title = 'prode-homepage';
}
