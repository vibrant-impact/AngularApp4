import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EventService } from '../services/event.service';

/**
 * Synchronous cross-field form validator ensuring an optional endDate
 * is chronologically on or after the peak/start date.
 *
 * @param control - Parent FormGroup containing 'date' and 'endDate' controls
 * @returns `{ invalidDateRange: true }` when endDate precedes startDate, otherwise null
 */
export const validateAlignmentDateRange: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const startDateValue = control.get('date')?.value;
  const endDateValue = control.get('endDate')?.value;

  if (!startDateValue || !endDateValue) {
    return null;
  }

  const start = new Date(startDateValue);
  const end = new Date(endDateValue);

  if (end < start) {
    return { invalidDateRange: true };
  }

  return null;
};

/**
 * Asynchronous field validator verifying that an alignment title is unique
 * across both generated ephemeris transits and custom user events.
 *
 * @param eventService - Injected EventService used to query existing event titles
 * @param excludeEventId - Optional ID to ignore when editing an existing event
 * @returns AsyncValidatorFn emitting `{ duplicateAlignmentTitle: true }` if taken
 */
export function validateUniqueAlignmentTitle(
  eventService: EventService,
  excludeEventId?: string
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const rawValue = control.value as string;
    if (!rawValue || rawValue.trim().length < 3) {
      return of(null);
    }

    return eventService.isTitleTaken(rawValue, excludeEventId).pipe(
      map((isTaken) => (isTaken ? { duplicateAlignmentTitle: true } : null)),
      catchError(() => of(null))
    );
  };
}