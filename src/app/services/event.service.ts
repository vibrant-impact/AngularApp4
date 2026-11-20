import { Injectable, computed, signal } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, delay, map, switchMap } from 'rxjs/operators';
import {
  BirthProfile,
  EventCategoryId,
  ReflectionNote,
  RitualCommitment,
  RitualStatus,
  TransitEvent,
  ZodiacSign,
} from '../models/astrology.model';
import { DEFAULT_BIRTH_PROFILE } from '../data/astrology.presets';
import {
  calculateHouse,
  calculateNatalChart,
  generatePersonalizedEvents,
  signToLon,
} from '../engine/ephemeris.engine';

/**
 * Payload shape submitted by the Reactive Form when creating a custom alignment event.
 */
export interface CustomAlignmentInput {
  title: string;
  date: string;
  endDate?: string;
  timeWindow: TransitEvent['timeWindow'];
  category: EventCategoryId;
  sign: ZodiacSign;
  ritualTitle: string;
  ritualSteps: string[];
  summary: string;
}

/**
 * Central state and ephemeris service managing natal chart calculations,
 * 2026-2027 transit events, ritual RSVPs, reflection logs, and simulated HTTP operations.
 */
@Injectable({
  providedIn: 'root',
})
export class EventService {
  private readonly customEventsStorageKey = 'syzygy_angular_custom_events_v1';
  private readonly profileStorageKey = 'syzygy_angular_birth_profile_v1';
  private readonly commitmentsStorageKey = 'syzygy_angular_commitments_v1';
  private readonly notesStorageKey = 'syzygy_angular_notes_v1';

  /** Toggleable flag used to simulate HTTP server failures for error-handling demonstrations. */
  readonly simulateServerFailure = signal<boolean>(false);

  // Private writable signals backed by browser localStorage
  private readonly birthProfileState = signal<BirthProfile>(this.loadBirthProfile());
  private readonly customEventsState = signal<TransitEvent[]>(this.loadCustomEvents());
  private readonly commitmentsState = signal<Record<string, RitualCommitment>>(this.loadCommitments());
  private readonly reflectionNotesState = signal<ReflectionNote[]>(this.loadNotes());

  // Public read-only signal exposures for reactive UI consumption
  readonly birthProfile = this.birthProfileState.asReadonly();
  readonly customEvents = this.customEventsState.asReadonly();
  readonly commitments = this.commitmentsState.asReadonly();
  readonly reflectionNotes = this.reflectionNotesState.asReadonly();

  /** Live calculated natal chart (defaults to April 13, 1977, Red Deer, AB). */
  readonly natalChart = computed(() => calculateNatalChart(this.birthProfileState()));

  /** Full 2026-2027 ephemeris transits merged chronologically with user-created custom alignments. */
  readonly allEvents = computed<TransitEvent[]>(() => {
    const generated = generatePersonalizedEvents(this.natalChart(), '2026-01-01', '2027-12-31');
    return [...generated, ...this.customEventsState()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  });

  /** Count of transit rituals currently marked as committed. */
  readonly committedCount = computed(
    () => Object.values(this.commitmentsState()).filter((c) => c.status === 'committed').length
  );

  /** Count of transit rituals marked as completed. */
  readonly completedCount = computed(
    () => Object.values(this.commitmentsState()).filter((c) => c.status === 'completed').length
  );

  /**
   * Retrieves a single transit or custom alignment event by its unique identifier.
   */
  getEventById(eventId: string): TransitEvent | undefined {
    return this.allEvents().find((event) => event.id === eventId);
  }

  /**
   * Asynchronous uniqueness check consumed by the custom Reactive Form async validator.
   * Simulates a 350ms network lookup against existing ephemeris and custom event titles.
   */
  isTitleTaken(candidateTitle: string, excludeEventId?: string): Observable<boolean> {
    const normalized = candidateTitle.trim().toLowerCase();
    return timer(350).pipe(
      map(() =>
        this.allEvents().some(
          (event) =>
            event.id !== excludeEventId && event.title.trim().toLowerCase() === normalized
        )
      )
    );
  }

  /**
   * Simulated HTTP POST endpoint to create and persist a custom cosmic alignment event.
   * Emits an RxJS error observable when `simulateServerFailure` is enabled.
   */
  createCustomEvent(input: CustomAlignmentInput): Observable<TransitEvent> {
    if (this.simulateServerFailure()) {
      return throwError(
        () => new Error('Cosmic Ephemeris Sync Error (503): Unable to save alignment to server.')
      ).pipe(delay(400));
    }

    // Calculate which natal house the chosen zodiac sign activates
    const chart = this.natalChart();
    const longitude = signToLon(input.sign, 15);
    const houseActivated = calculateHouse(
      longitude,
      chart.placements.Ascendant.longitude,
      chart.profile.houseSystem,
      chart.houseCusps
    );

    const createdEvent: TransitEvent = {
      id: `custom-${crypto.randomUUID()}`,
      title: input.title.trim(),
      subtitle: `Personal Alignment · ${input.sign}`,
      date: input.date,
      endDate: input.endDate || undefined,
      timeWindow: input.timeWindow,
      category: input.category,
      userTags: ['healing'],
      intensity: 'medium',
      transitingPlanet: 'Moon',
      transitingSign: input.sign,
      transitingDegree: 15,
      houseActivated,
      summary: input.summary.trim(),
      ritualTitle: input.ritualTitle.trim(),
      ritualSteps:
        input.ritualSteps.length > 0
          ? input.ritualSteps
          : ['Set a quiet 15-minute container and record your core intention.'],
      ritualDuration: '20 min',
      isCustom: true,
    };

    return of(createdEvent).pipe(
      delay(450),
      map((event) => {
        this.customEventsState.update((current) => {
          const updated = [...current, event];
          localStorage.setItem(this.customEventsStorageKey, JSON.stringify(updated));
          return updated;
        });
        return event;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Simulated HTTP PUT endpoint to update the active natal birth profile.
   */
  updateBirthProfile(nextProfile: BirthProfile): Observable<BirthProfile> {
    if (this.simulateServerFailure()) {
      return throwError(
        () => new Error('Ephemeris Calculation Timeout (504): Birth chart update failed.')
      ).pipe(delay(400));
    }

    return of(nextProfile).pipe(
      delay(350),
      map((profile) => {
        this.birthProfileState.set(profile);
        localStorage.setItem(this.profileStorageKey, JSON.stringify(profile));
        return profile;
      })
    );
  }

  /**
   * Simulated HTTP POST endpoint for the Template-Driven Ritual RSVP & Reflection form.
   * Persists both the user's ritual commitment and any optional reflection journal entry.
   */
  saveRitualAndReflection(
    event: TransitEvent,
    rsvpData: {
      status: RitualStatus;
      scheduledTime: string;
      completedSteps?: number[];
      intention: string;
      reminderEmail?: string;
      reflectionContent?: string;
      resonance?: ReflectionNote['resonance'];
    }
  ): Observable<boolean> {
    if (this.simulateServerFailure()) {
      return throwError(
        () => new Error('Journal Sync Error (500): Could not persist your ritual RSVP.')
      ).pipe(delay(400));
    }

    return of(true).pipe(
      delay(400),
      switchMap(() => {
        this.commitmentsState.update((current) => {
          const existing = current[event.id];
          const updated: Record<string, RitualCommitment> = {
            ...current,
            [event.id]: {
              eventId: event.id,
              status: rsvpData.status,
              scheduledTime: rsvpData.scheduledTime,
              intention: rsvpData.intention,
              completedSteps: rsvpData.completedSteps ?? existing?.completedSteps ?? [],
              updatedAt: new Date().toISOString(),
            },
          };
          localStorage.setItem(this.commitmentsStorageKey, JSON.stringify(updated));
          return updated;
        });

        // Append a new reflection note if the user entered journal text
        if (rsvpData.reflectionContent && rsvpData.reflectionContent.trim().length > 0) {
          const newNote: ReflectionNote = {
            id: `note-${crypto.randomUUID()}`,
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            category: event.category,
            planet: event.transitingPlanet,
            content: rsvpData.reflectionContent.trim(),
            resonance: rsvpData.resonance ?? 'Grounded',
            createdAt: new Date().toISOString(),
          };
          this.reflectionNotesState.update((current) => {
            const updated = [newNote, ...current];
            localStorage.setItem(this.notesStorageKey, JSON.stringify(updated));
            return updated;
          });
        }

        return of(true);
      })
    );
  }

  /**
   * Toggles an individual ritual checklist step and automatically marks the ritual
   * as 'completed' once all actionable steps have been checked off.
   */
  toggleRitualStep(event: TransitEvent, stepIndex: number): void {
    this.commitmentsState.update((current) => {
      const existing = current[event.id];
      const currentSteps = existing?.completedSteps ?? [];
      const nextSteps = currentSteps.includes(stepIndex)
        ? currentSteps.filter((index) => index !== stepIndex)
        : [...currentSteps, stepIndex];

      const allStepsCompleted =
        event.ritualSteps.length > 0 && nextSteps.length === event.ritualSteps.length;

      const updated: Record<string, RitualCommitment> = {
        ...current,
        [event.id]: {
          eventId: event.id,
          status: allStepsCompleted
            ? 'completed'
            : existing?.status === 'uncommitted' || !existing
            ? 'committed'
            : existing.status,
          scheduledTime: existing?.scheduledTime ?? '20:00',
          intention: existing?.intention ?? '',
          completedSteps: nextSteps,
          updatedAt: new Date().toISOString(),
        },
      };

      localStorage.setItem(this.commitmentsStorageKey, JSON.stringify(updated));
      return updated;
    });
  }

  /**
   * Simulated HTTP DELETE endpoint for removing user-created custom alignments.
   */
  deleteCustomEvent(eventId: string): Observable<boolean> {
    if (this.simulateServerFailure()) {
      return throwError(() => new Error('Delete Request Failed (503): Server unavailable.')).pipe(
        delay(300)
      );
    }
    return of(true).pipe(
      delay(300),
      map(() => {
        this.customEventsState.update((current) => {
          const updated = current.filter((event) => event.id !== eventId);
          localStorage.setItem(this.customEventsStorageKey, JSON.stringify(updated));
          return updated;
        });
        return true;
      })
    );
  }

  /** Safely hydrates the saved birth profile from localStorage with fallback to Red Deer preset. */
  private loadBirthProfile(): BirthProfile {
    try {
      const raw = localStorage.getItem(this.profileStorageKey);
      return raw ? (JSON.parse(raw) as BirthProfile) : DEFAULT_BIRTH_PROFILE;
    } catch {
      return DEFAULT_BIRTH_PROFILE;
    }
  }

  /** Safely hydrates user-created custom alignment events from localStorage. */
  private loadCustomEvents(): TransitEvent[] {
    try {
      const raw = localStorage.getItem(this.customEventsStorageKey);
      return raw ? (JSON.parse(raw) as TransitEvent[]) : [];
    } catch {
      return [];
    }
  }

  /** Safely hydrates ritual RSVP commitments from localStorage. */
  private loadCommitments(): Record<string, RitualCommitment> {
    try {
      const raw = localStorage.getItem(this.commitmentsStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, RitualCommitment>) : {};
    } catch {
      return {};
    }
  }

  /** Safely hydrates personal reflection notes from localStorage. */
  private loadNotes(): ReflectionNote[] {
    try {
      const raw = localStorage.getItem(this.notesStorageKey);
      return raw ? (JSON.parse(raw) as ReflectionNote[]) : [];
    } catch {
      return [];
    }
  }
}