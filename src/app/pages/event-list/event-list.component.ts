import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  EventCategoryId,
  PlanetId,
  PlannerView,
  TransitEvent,
} from '../../models/astrology.model';
import { HOUSE_THEMES, PLANET_GLYPHS, ZODIAC_GLYPHS } from '../../data/astrology.presets';
import { addDays, formatDateStr, formatDegree, parseDateStr } from '../../engine/ephemeris.engine';
import { EventService } from '../../services/event.service';
import { EventFormComponent } from '../../components/event-form/event-form.component';
import { EventDetailsComponent } from '../event-details/event-details.component';
import { BiWheelChartComponent } from '../../components/bi-wheel-chart/bi-wheel-chart.component';

export interface CalendarCell {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  exactEvents: TransitEvent[];
  hasActiveRetrograde: boolean;
  hasHighIntensity: boolean;
  lunarPhase?: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Last Quarter';
}

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    EventFormComponent,
    EventDetailsComponent,
    BiWheelChartComponent,
  ],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css',
})
export class EventListComponent {
  readonly eventService = inject(EventService);
  private readonly snackBar = inject(MatSnackBar);

  readonly houseThemes = HOUSE_THEMES;
  readonly planetGlyphs = PLANET_GLYPHS;
  readonly zodiacGlyphs = ZODIAC_GLYPHS;
  readonly formatDegree = formatDegree;
  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly timeframeOptions: PlannerView[] = ['day', 'week', 'month', 'year'];

  readonly activeTimeframe = signal<PlannerView>('month');
  readonly selectedDate = signal<string>(this.getInitialPlannerDate());
  readonly categoryFilter = signal<EventCategoryId | 'all'>('all');
  readonly highIntensityOnly = signal<boolean>(false);
  readonly focusedPlanet = signal<PlanetId | null>(null);
  readonly searchQuery = signal<string>('');
  readonly selectedEventId = signal<string | null>(null);
  readonly isCreatingNewEvent = signal<boolean>(false);

  readonly selectedEvent = computed<TransitEvent | null>(() => {
    const targetId = this.selectedEventId();
    return targetId ? this.eventService.getEventById(targetId) ?? null : null;
  });

  /** All events matching active category, intensity, planet, and text search filters */
  readonly matchingEvents = computed<TransitEvent[]>(() => {
    const category = this.categoryFilter();
    const onlyHigh = this.highIntensityOnly();
    const planet = this.focusedPlanet();
    const query = this.searchQuery().trim().toLowerCase();

    return this.eventService.allEvents().filter((event) => {
      if (category !== 'all' && event.category !== category) return false;
      if (onlyHigh && event.intensity !== 'high') return false;
      if (planet && event.transitingPlanet !== planet && event.natalPlanet !== planet) return false;
      if (query) {
        const text =
          `${event.title} ${event.subtitle} ${event.summary} ${event.transitingSign} ${event.ritualTitle}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  });

  /** 42-cell calendar matrix for the active month */
  readonly monthCalendarCells = computed<CalendarCell[]>(() => {
    const anchor = this.selectedDate();
    const { year, month } = parseDateStr(anchor);
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const firstDateObj = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = firstDateObj.getUTCDay();
    const gridStartDate = addDays(firstOfMonth, -startWeekday);
    const events = this.matchingEvents();

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = addDays(gridStartDate, index);
      const parsed = parseDateStr(cellDate);
      const occurring = events.filter(
        (ev) => ev.date === cellDate || Boolean(ev.endDate && ev.date <= cellDate && ev.endDate >= cellDate)
      );
      const exact = occurring.filter((ev) => ev.date === cellDate);

      return {
        date: cellDate,
        dayNumber: parsed.day,
        inCurrentMonth: parsed.month === month,
        exactEvents: exact,
        hasActiveRetrograde: occurring.some((ev) => ev.category === 'retrograde'),
        hasHighIntensity: exact.some((ev) => ev.intensity === 'high'),
        lunarPhase: exact.find((ev) => ev.lunarPhase)?.lunarPhase,
      };
    });
  });

  /** Alignments occurring on the clicked calendar day (or active timeframe list) */
  readonly selectedDayEvents = computed<TransitEvent[]>(() => {
    const anchor = this.selectedDate();
    const view = this.activeTimeframe();
    const events = this.matchingEvents();

    if (view === 'year') {
      return events.filter((ev) => ev.date.startsWith(anchor.slice(0, 4)) && ev.intensity === 'high');
    }
    if (view === 'week') {
      const weekEnd = addDays(anchor, 6);
      return events.filter(
        (ev) =>
          (ev.date >= anchor && ev.date <= weekEnd) ||
          Boolean(ev.endDate && ev.date <= weekEnd && ev.endDate >= anchor)
      );
    }
    return events.filter(
      (ev) => ev.date === anchor || Boolean(ev.endDate && ev.date <= anchor && ev.endDate >= anchor)
    );
  });

  readonly formattedMonthHeading = computed(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const { year, month, day } = parseDateStr(this.selectedDate());
    if (this.activeTimeframe() === 'year') return `${year} Ephemeris`;
    if (this.activeTimeframe() === 'day') return `${months[month - 1]} ${day}, ${year}`;
    return `${months[month - 1]} ${year}`;
  });

  selectCalendarDate(dateStr: string): void {
    this.selectedDate.set(dateStr);
    this.selectedEventId.set(null);
    this.isCreatingNewEvent.set(false);
  }

  jumpToYear(targetYear: number): void {
    const { month, day } = parseDateStr(this.selectedDate());
    this.selectedDate.set(
      `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`
    );
  }

  stepPeriod(direction: -1 | 1): void {
    const current = this.selectedDate();
    const timeframe = this.activeTimeframe();
    const { year, month, day } = parseDateStr(current);

    if (timeframe === 'day') {
      this.selectedDate.set(addDays(current, direction));
    } else if (timeframe === 'week') {
      this.selectedDate.set(addDays(current, direction * 7));
    } else if (timeframe === 'month') {
      const nextMonth = new Date(Date.UTC(year, month - 1 + direction, 1));
      this.selectedDate.set(
        `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`
      );
    } else {
      this.selectedDate.set(
        `${year + direction}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      );
    }
  }

  resetToToday(): void {
    this.selectedDate.set(this.getInitialPlannerDate());
  }

  openEventDetails(event: TransitEvent): void {
    this.isCreatingNewEvent.set(false);
    this.selectedEventId.set(event.id);
  }

  openCreateForm(): void {
    this.selectedEventId.set(null);
    this.isCreatingNewEvent.set(true);
  }

  handleAlignmentCreated(createdEvent: TransitEvent): void {
    this.isCreatingNewEvent.set(false);
    this.selectedDate.set(createdEvent.date);
    this.selectedEventId.set(createdEvent.id);
  }

  deleteCustomAlignment(event: TransitEvent, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventService.deleteCustomEvent(event.id).subscribe({
      next: () => {
        if (this.selectedEventId() === event.id) this.selectedEventId.set(null);
        this.snackBar.open(`Removed "${event.title}".`, 'Close', { duration: 3000 });
      },
      error: (err: Error) => {
        this.snackBar.open(err.message, 'Close', { duration: 4000 });
      },
    });
  }

  private getInitialPlannerDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    return year >= 2026 && year <= 2027 ? formatDateStr(today) : '2026-11-19';
  }
}