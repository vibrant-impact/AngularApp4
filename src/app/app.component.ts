import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { EventService } from './services/event.service';
import { EventListComponent } from './pages/event-list/event-list.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatToolbarModule, MatSlideToggleModule, EventListComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly eventService = inject(EventService);
}