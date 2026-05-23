import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-match-multiplier-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-multiplier-badge.component.html',
  styleUrl: './match-multiplier-badge.component.scss',
  host: {
    class: 'match-multiplier-badge-host',
    '[class.schedule-gap]': "variant === 'schedule-gap'",
    '[class.star]': "variant === 'star'"
  }
})
export class MatchMultiplierBadgeComponent {
  @Input() variant: 'default' | 'star' | 'schedule-gap' = 'default';
}
