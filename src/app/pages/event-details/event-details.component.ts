import { Component, Input, OnChanges, computed, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  ResonanceTag,
  RitualStatus,
  TransitEvent,
} from '../../models/astrology.model';
import { HOUSE_THEMES, PLANET_GLYPHS, ZODIAC_GLYPHS } from '../../data/astrology.presets';
import { formatDegree } from '../../engine/ephemeris.engine';
import { EventService } from '../../services/event.service';
import { ErrorDialogComponent } from '../../components/error-dialog/error-dialog.component';

/**
 * Transit detail inspector featuring a Template-Driven Form (NgForm)
 * for Ritual RSVPs, email alert validation, interactive checklist steps, and reflection notes.
 */
@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.css',
})
export class EventDetailsComponent implements OnChanges {
  readonly eventService = inject(EventService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  @Input({ required: true }) event!: TransitEvent;

  readonly houseThemes = HOUSE_THEMES;
  readonly planetGlyphs = PLANET_GLYPHS;
  readonly zodiacGlyphs = ZODIAC_GLYPHS;
  readonly formatDegree = formatDegree;

  readonly resonanceOptions: ResonanceTag[] = [
    'Grounded',
    'Activated',
    'Breakthrough',
    'Tender',
    'Clear',
  ];

  /** Two-way bound model backing the Template-Driven Ritual RSVP & Reflection form. */
  rsvpModel = {
    status: 'committed' as RitualStatus,
    scheduledTime: '20:00',
    reminderEmail: '',
    intention: '',
    resonance: 'Grounded' as ResonanceTag,
    reflectionContent: '',
  };

  isSavingRsvp = false;

  /** Reactive lookup of any existing RSVP commitment for the currently selected transit. */
  readonly existingCommitment = computed(
    () => this.eventService.commitments()[this.event?.id]
  );

  /** Filtered list of personal reflection notes attached to the active transit. */
  readonly eventNotes = computed(() =>
    this.eventService.reflectionNotes().filter((note) => note.eventId === this.event?.id)
  );

  /** Synchronizes the Template-Driven form model whenever the user selects a different event. */
  ngOnChanges(): void {
    const saved = this.eventService.commitments()[this.event.id];
    if (saved) {
      this.rsvpModel.status = saved.status;
      this.rsvpModel.scheduledTime = saved.scheduledTime;
      this.rsvpModel.intention = saved.intention;
    } else {
      this.rsvpModel.status = 'committed';
      this.rsvpModel.scheduledTime = '20:00';
      this.rsvpModel.intention = '';
    }
  }

  /** Checks whether a specific ritual checklist step has been completed. */
  isStepCompleted(stepIndex: number): boolean {
    return this.existingCommitment()?.completedSteps?.includes(stepIndex) ?? false;
  }

  /** Toggles a ritual checklist item and syncs the resulting RSVP status to the form model. */
  toggleStep(stepIndex: number): void {
    this.eventService.toggleRitualStep(this.event, stepIndex);
    const updated = this.eventService.commitments()[this.event.id];
    if (updated) {
      this.rsvpModel.status = updated.status;
    }
  }

  /**
   * Submits the Template-Driven form to EventService and handles simulated HTTP failures
   * with an Angular Material error dialog.
   */
  submitRitualRsvp(form: NgForm): void {
    if (form.invalid) {
      this.snackBar.open('Please check the email and intention fields before saving.', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isSavingRsvp = true;
    this.eventService
      .saveRitualAndReflection(this.event, {
        ...this.rsvpModel,
        completedSteps: this.existingCommitment()?.completedSteps ?? [],
      })
      .subscribe({
        next: () => {
          this.isSavingRsvp = false;
          this.snackBar.open('Ritual RSVP & Reflection saved to your cosmic log!', 'Done', {
            duration: 3500,
          });
          this.rsvpModel.reflectionContent = '';
        },
        error: (error: Error) => {
          this.isSavingRsvp = false;
          this.dialog.open(ErrorDialogComponent, {
            width: '400px',
            data: {
              title: 'Ritual Sync Error',
              message: error.message,
            },
          });
        },
      });
  }
}