# Syzygy — Astrological Transit & Cosmic Alignment Planner (`AngularApp4`)

A personalized astrological transit planner and cosmic alignment scheduler built with **Angular 19**, **TypeScript**, **Angular Signals**, **RxJS**, and **Angular Material**. Powered by an astronomical ephemeris engine (`astronomy-engine`), Syzygy calculates planetary transits, retrogrades, moon phases, and natal chart activations across 2026–2027, allowing users to schedule custom alignment rituals, RSVP to events, and record personal reflections.

---

## Key Features & Assignment Alignment (Ch. 10–12)

### 1. Interactive Cosmic Timeline & Live Bi-Wheel Compass
* **42-Cell Monthly Calendar Grid:** Displays daily planetary transits, eclipses, lunar phases (`●` New Moon / `○` Full Moon), retrograde spans, and peak-intensity markers (`▲`).
* **Multi-Timeframe & Category Filtering:** Filter events across **Day**, **Week**, **Month**, and **Year** horizons or sort by alignment category (*Natal Activations*, *Planetary Shifts*, *Moon Phases*, *Retrogrades*, *Custom Rituals*, and *High Intensity*).
* **SVG Natal & Transit Bi-Wheel:** Compares natal chart placements against live sky transits for any selected calendar date, with interactive planet filtering.

### 2. Reactive Form — Custom Cosmic Alignment Creator (`EventFormComponent`)
* **Angular Material UI Components:** Built with `mat-form-field`, `mat-input`, `mat-datepicker`, `mat-select`, and `mat-button`.
* **Built-In Validation:** Enforces required fields, minimum/maximum character lengths, and proper date selection with inline `<mat-error>` feedback.
* **Custom Synchronous Cross-Field Validator (`validateAlignmentDateRange`):** Validates that an optional retrograde/span `endDate` is never earlier than the event's peak/start `date`.
* **Custom Asynchronous Validator (`validateUniqueAlignmentTitle`):** Queries `EventService` asynchronously on blur to prevent duplicate alignment titles across both generated ephemeris transits and custom events.

### 3. Template-Driven Form — Ritual RSVP & Reflection Check-In (`EventDetailsComponent`)
* **Two-Way Data Binding (`ngForm` & `[(ngModel)]`):** Enables users to commit to alignment rituals, schedule ritual times, and log personal reflection notes.
* **Template-Driven Validation:** Validates required intention lengths (`required`, `minlength`) and optional transit reminder email addresses (`email`) with clear `<mat-error>` messages.
* **Actionable Ritual Checklist:** Interactive Angular Material checkboxes (`mat-checkbox`) track completion of each transit's recommended ritual steps and automatically mark the RSVP as **Completed** once all steps are checked.

### 4. Graceful Error Handling Strategy
* **Form-Level Feedback:** Displays contextual `<mat-error>` messages and `MatSnackBar` notifications if a user attempts to submit invalid or pending form fields.
* **Simulated HTTP Failure Handling:** Includes a **Simulate HTTP Error** `mat-slide-toggle` in the main toolbar that triggers RxJS `throwError` responses in `EventService`. Simulated service errors are caught cleanly and surfaced to the user via Angular Material's **`MatSnackBar`** and **`MatDialog`** (`ErrorDialogComponent`).

---

## Project Structure

```text
src/
├── app/
│   ├── components/
│   │   ├── bi-wheel-chart/      # Interactive SVG natal & transit bi-wheel compass
│   │   ├── error-dialog/        # Angular Material MatDialog for HTTP error display
│   │   └── event-form/          # Reactive Form for custom cosmic alignments
│   ├── data/
│   │   └── astrology.presets.ts # Zodiac glyphs, house themes, city & birth presets
│   ├── engine/
│   │   └── ephemeris.engine.ts  # VSOP87/ELP2000 tropical ephemeris & transit generator
│   ├── models/
│   │   └── astrology.model.ts   # TypeScript interfaces for charts, transits & notes
│   ├── pages/
│   │   ├── event-details/       # Template-Driven Form for ritual RSVPs & reflections
│   │   └── event-list/          # Calendar matrix, filter chips & inspector layout
│   ├── services/
│   │   └── event.service.ts     # Signal-based state, localStorage & simulated HTTP calls
│   └── validators/
│       └── alignment.validators.ts # Custom sync date-range & async title validators
└── styles.css                   # High-contrast cosmic purple, lime, sky-blue & orange theme
```

---

## Local Setup & Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   ng serve
   ```
   Navigate to `http://localhost:4200/` in your browser.

3. **Build for production:**
   ```bash
   ng build
   ```