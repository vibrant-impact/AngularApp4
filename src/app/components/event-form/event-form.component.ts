import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ZODIAC_SIGNS } from '../../data/astrology.presets';
import { EventCategoryId, TransitEvent, ZodiacSign } from '../../models/astrology.model';
import { CustomAlignmentInput, EventService } from '../../services/event.service';
import {
  validateAlignmentDateRange,
  validateUniqueAlignmentTitle,
} from '../../validators/alignment.validators';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';

/**
 * Reactive Form component for scheduling custom cosmic alignment events.
 * Uses Angular Material form controls, built-in validators, custom sync/async validators,
 * and MatSnackBar / MatDialog error handling.
 */
@Component({
  selector: 'app-event-form',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.css',
})
export class EventFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  @Output() alignmentCreated = new EventEmitter<TransitEvent>();
  @Output() cancelled = new EventEmitter<void>();

  readonly zodiacSigns = ZODIAC_SIGNS;
  readonly timeWindows: TransitEvent['timeWindow'][] = [
    'Dawn',
    'Midday',
    'Dusk',
    'Night',
    'All Day',
  ];
  readonly categoryOptions: { value: EventCategoryId; label: string }[] = [
    { value: 'custom', label: 'Personal Alignment Ritual' },
    { value: 'transit', label: 'Planetary Ingress / Shift' },
    { value: 'activation', label: 'Natal Chart Activation' },
    { value: 'retrograde', label: 'Retrograde Review Window' },
  ];

  isSubmitting = false;

  /**
   * Strongly-typed Reactive FormGroup combining built-in validators,
   * an async title uniqueness validator, and a cross-field date-range validator.
   */
  readonly alignmentForm = this.formBuilder.nonNullable.group(
    {
      title: [
        '',
        {
          validators: [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
          asyncValidators: [validateUniqueAlignmentTitle(this.eventService)],
          updateOn: 'blur',
        },
      ],
      date: [new Date(), [Validators.required]],
      endDate: [null as Date | null],
      timeWindow: ['Dusk' as TransitEvent['timeWindow'], [Validators.required]],
      category: ['custom' as EventCategoryId, [Validators.required]],
      sign: ['Taurus' as ZodiacSign, [Validators.required]],
      ritualTitle: ['', [Validators.required, Validators.minLength(3)]],
      ritualStepsText: ['', [Validators.maxLength(800)]],
      summary: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]],
    },
    { validators: [validateAlignmentDateRange] }
  );

  /**
   * Validates the Reactive Form and dispatches the payload to EventService.
   * Catches simulated HTTP errors and presents user-friendly Material feedback.
   */
  submitAlignmentForm(): void {
    this.alignmentForm.markAllAsTouched();
    if (this.alignmentForm.invalid || this.alignmentForm.pending) {
      this.snackBar.open('Please resolve the highlighted form validation errors.', 'Close', {
        duration: 3500,
      });
      return;
    }

    this.isSubmitting = true;
    const rawValues = this.alignmentForm.getRawValue();

    // Split multi-line ritual instructions into clean individual checklist steps
    const parsedSteps = rawValues.ritualStepsText
      .split('\n')
      .map((step) => step.trim())
      .filter((step) => step.length > 0);

    const payload: CustomAlignmentInput = {
      title: rawValues.title.trim(),
      date: this.formatIsoDate(rawValues.date),
      endDate: rawValues.endDate ? this.formatIsoDate(rawValues.endDate) : undefined,
      timeWindow: rawValues.timeWindow,
      category: rawValues.category,
      sign: rawValues.sign,
      ritualTitle: rawValues.ritualTitle.trim(),
      ritualSteps: parsedSteps,
      summary: rawValues.summary.trim(),
    };

    this.eventService.createCustomEvent(payload).subscribe({
      next: (createdEvent) => {
        this.isSubmitting = false;
        this.snackBar.open(`Saved "${createdEvent.title}" to your cosmic timeline!`, 'Nice', {
          duration: 3500,
        });
        this.alignmentCreated.emit(createdEvent);
      },
      error: (error: Error) => {
        this.isSubmitting = false;
        // Surface HTTP error via both MatSnackBar and MatDialog
        this.snackBar.open('Failed to save cosmic alignment event.', 'Details', {
          duration: 4000,
        });
        this.dialog.open(ErrorDialogComponent, {
          width: '400px',
          data: {
            title: 'Ephemeris Sync Failed',
            message: error.message || 'An unexpected service error occurred while saving.',
          },
        });
      },
    });
  }

  /** Formats a JavaScript Date instance into an ISO YYYY-MM-DD calendar string. */
  private formatIsoDate(dateValue: Date): string {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}