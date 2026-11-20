import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import {
  PLANET_GLYPHS,
  PLANET_LABELS,
  ZODIAC_GLYPHS,
  ZODIAC_SIGNS,
} from '../../data/astrology.presets';
import {
  findAspect,
  formatDegree,
  getSkyPositions,
  normDeg,
} from '../../engine/ephemeris.engine';
import { NatalChart, PlanetId } from '../../models/astrology.model';

type RingPlanetId = Exclude<PlanetId, 'Ascendant' | 'Midheaven'>;

@Component({
  selector: 'app-bi-wheel-chart',
  standalone: true,
  template: `
    <div class="biwheel-wrapper">
      <svg
        viewBox="0 0 440 440"
        class="biwheel-svg"
        role="img"
        [attr.aria-label]="'Astrological bi-wheel for ' + selectedDateSignal()"
      >
        <circle cx="220" cy="220" r="204" fill="#160E2C" stroke="#382864" stroke-width="1" />
        <circle cx="220" cy="220" r="180" fill="#1B1233" stroke="#46337A" stroke-width="1" />
        <circle cx="220" cy="220" r="152" fill="#140C28" stroke="#382864" stroke-width="1" />
        <circle cx="220" cy="220" r="96" fill="#120B24" stroke="#382864" stroke-width="1" />

        <!-- 12 Zodiac Sign Sectors -->
        @for (sector of zodiacSectors(); track sector.sign) {
          <g>
            <line
              [attr.x1]="sector.pIn.x"
              [attr.y1]="sector.pIn.y"
              [attr.x2]="sector.pOut.x"
              [attr.y2]="sector.pOut.y"
              stroke="#33245C"
              stroke-width="1"
            />
            <text
              [attr.x]="sector.pGlyph.x"
              [attr.y]="sector.pGlyph.y"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="12"
              [attr.fill]="sector.isChironSign ? '#B8FF3B' : '#A99CD4'"
              [attr.font-weight]="sector.isChironSign ? '700' : '500'"
            >
              {{ sector.glyph }}
            </text>
          </g>
        }

        <!-- Ascendant Horizon Axis -->
        <line x1="16" y1="220" x2="124" y2="220" stroke="#B8FF3B" stroke-width="1.5" />
        <line x1="316" y1="220" x2="424" y2="220" stroke="#46337A" stroke-width="1" stroke-dasharray="3 3" />
        <text x="82" y="214" font-size="9" fill="#B8FF3B" font-family="monospace" font-weight="600">
          ASC
        </text>

        <!-- Midheaven Axis -->
        <line
          [attr.x1]="mcAxis().pIn.x"
          [attr.y1]="mcAxis().pIn.y"
          [attr.x2]="mcAxis().pOut.x"
          [attr.y2]="mcAxis().pOut.y"
          stroke="#38BDF8"
          stroke-width="1.25"
          stroke-dasharray="4 2"
        />

        <!-- Aspect Chords -->
        @for (chord of aspectChords(); track $index) {
          <line
            [attr.x1]="chord.p1.x"
            [attr.y1]="chord.p1.y"
            [attr.x2]="chord.p2.x"
            [attr.y2]="chord.p2.y"
            [attr.stroke]="chord.strokeColor"
            [attr.stroke-width]="chord.isHighlighted ? 1.5 : 0.5"
            [attr.stroke-opacity]="chord.isHighlighted ? 0.85 : 0.16"
          />
        }

        <!-- Center Hub -->
        <circle cx="220" cy="220" r="34" fill="#160E2C" stroke="#382864" stroke-width="1" />
        <text x="220" y="214" text-anchor="middle" font-size="9" fill="#9F92C9" font-family="monospace">
          TRANSITS
        </text>
        <text x="220" y="229" text-anchor="middle" font-size="10" fill="#F6F3FF" font-family="monospace" font-weight="600">
          {{ selectedDateSignal().slice(5) }}
        </text>

        <!-- Inner Ring: Natal Placements -->
        @for (node of natalNodes(); track node.planet) {
          <g (click)="togglePlanet(node.planet)" style="cursor: pointer;">
            <line
              [attr.x1]="node.pMark.x"
              [attr.y1]="node.pMark.y"
              [attr.x2]="node.pGlyph.x"
              [attr.y2]="node.pGlyph.y"
              [attr.stroke]="node.isChiron ? '#B8FF3B' : '#38BDF8'"
              stroke-opacity="0.35"
              stroke-width="0.75"
            />
            <rect
              [attr.x]="node.pGlyph.x - 10"
              [attr.y]="node.pGlyph.y - 10"
              width="20"
              height="20"
              [attr.fill]="node.isSelected ? '#B8FF3B' : node.isChiron ? '#253319' : '#18253E'"
              [attr.stroke]="node.isSelected ? '#B8FF3B' : node.isChiron ? '#B8FF3B' : '#38BDF8'"
              stroke-width="1"
            />
            <text
              [attr.x]="node.pGlyph.x"
              [attr.y]="node.pGlyph.y + 0.5"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="11"
              [attr.fill]="node.isSelected ? '#120B24' : node.isChiron ? '#B8FF3B' : '#7DD3FC'"
              font-weight="600"
            >
              {{ node.glyph }}
            </text>
            <title>{{ node.tooltip }}</title>
          </g>
        }

        <!-- Outer Ring: Live Sky Transits -->
        @for (node of transitNodes(); track node.planet) {
          <g (click)="togglePlanet(node.planet)" style="cursor: pointer;">
            <line
              [attr.x1]="node.pTick.x"
              [attr.y1]="node.pTick.y"
              [attr.x2]="node.pGlyph.x"
              [attr.y2]="node.pGlyph.y"
              [attr.stroke]="node.isHighlighted ? '#FF7A2F' : '#8D81B3'"
              stroke-opacity="0.45"
              stroke-width="0.75"
            />
            <rect
              [attr.x]="node.pGlyph.x - 9.5"
              [attr.y]="node.pGlyph.y - 9.5"
              width="19"
              height="19"
              [attr.fill]="node.isSelected ? '#FF7A2F' : '#120B24'"
              [attr.stroke]="node.isSelected ? '#FF7A2F' : node.isHighlighted ? '#FF7A2F' : '#6A58A3'"
              stroke-width="1"
            />
            <text
              [attr.x]="node.pGlyph.x"
              [attr.y]="node.pGlyph.y + 0.5"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="10.5"
              [attr.fill]="node.isSelected ? '#120B24' : node.isHighlighted ? '#FF9A5C' : '#F6F3FF'"
              font-weight="600"
            >
              {{ node.glyph }}
            </text>
            <title>{{ node.tooltip }}</title>
          </g>
        }
      </svg>

      <div class="biwheel-legend">
        <span><i class="swatch natal"></i> Natal</span>
        <span><i class="swatch chiron"></i> Chiron</span>
        <span><i class="swatch transit"></i> Transit / Rx</span>
        @if (focusedPlanetSignal(); as activePlanet) {
          <button type="button" class="clear-btn" (click)="planetSelected.emit(null)">
            Clear {{ planetLabels[activePlanet] }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .biwheel-wrapper { display: flex; flex-direction: column; align-items: center; }
    .biwheel-svg { width: 100%; max-width: 360px; height: auto; user-select: none; }
    .biwheel-legend {
      width: 100%; margin-top: 0.75rem; padding-top: 0.75rem;
      border-top: 1px solid #382864; display: flex; flex-wrap: wrap;
      justify-content: space-between; gap: 0.5rem; font-size: 0.75rem; color: #BEB4DE;
    }
    .swatch { display: inline-block; width: 9px; height: 9px; margin-right: 4px; }
    .swatch.natal { background: #18253E; border: 1px solid #38BDF8; }
    .swatch.chiron { background: #253319; border: 1px solid #B8FF3B; }
    .swatch.transit { background: #120B24; border: 1px solid #FF7A2F; }
    .clear-btn { background: none; border: none; color: #B8FF3B; cursor: pointer; font-family: monospace; }
  `],
})
export class BiWheelChartComponent {
  readonly natalChartSignal = signal<NatalChart | null>(null);
  readonly selectedDateSignal = signal<string>('2026-11-19');
  readonly focusedPlanetSignal = signal<PlanetId | null>(null);

  @Input({ required: true }) set natalChart(value: NatalChart) {
    this.natalChartSignal.set(value);
  }
  @Input({ required: true }) set selectedDate(value: string) {
    this.selectedDateSignal.set(value);
  }
  @Input() set focusedPlanet(value: PlanetId | null) {
    this.focusedPlanetSignal.set(value);
  }

  @Output() planetSelected = new EventEmitter<PlanetId | null>();

  readonly planetLabels = PLANET_LABELS;
  private readonly ringPlanets: RingPlanetId[] = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
    'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'NorthNode',
  ];

  readonly zodiacSectors = computed(() => {
    const chart = this.natalChartSignal();
    const ascLon = chart?.placements.Ascendant.longitude ?? 0;
    return ZODIAC_SIGNS.map((sign, index) => {
      const startLon = index * 30;
      const midLon = startLon + 15;
      return {
        sign,
        glyph: ZODIAC_GLYPHS[sign],
        isChironSign: sign === chart?.chironSign,
        pOut: this.polar(220, 220, 180, this.lonToAngle(startLon, ascLon)),
        pIn: this.polar(220, 220, 96, this.lonToAngle(startLon, ascLon)),
        pGlyph: this.polar(220, 220, 166, this.lonToAngle(midLon, ascLon)),
      };
    });
  });

  readonly mcAxis = computed(() => {
    const chart = this.natalChartSignal();
    const ascLon = chart?.placements.Ascendant.longitude ?? 0;
    const mcLon = chart?.placements.Midheaven.longitude ?? 270;
    const angle = this.lonToAngle(mcLon, ascLon);
    return {
      pIn: this.polar(220, 220, 96, angle),
      pOut: this.polar(220, 220, 204, angle),
    };
  });

  readonly aspectChords = computed(() => {
    const chart = this.natalChartSignal();
    if (!chart) return [];
    const sky = getSkyPositions(this.selectedDateSignal(), 12);
    const ascLon = chart.placements.Ascendant.longitude;
    const focused = this.focusedPlanetSignal();
    const chords: { p1: { x: number; y: number }; p2: { x: number; y: number }; strokeColor: string; isHighlighted: boolean }[] = [];

    for (const tp of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Chiron'] as RingPlanetId[]) {
      for (const np of ['Sun', 'Moon', 'Ascendant', 'Midheaven', 'Venus', 'Mars', 'Saturn', 'Chiron'] as PlanetId[]) {
        const hit = findAspect(sky[tp].longitude, chart.placements[np].longitude, 3.0);
        if (hit) {
          const isHard = hit.aspect === 'Conjunction' || hit.aspect === 'Opposition' || hit.aspect === 'Square';
          chords.push({
            p1: this.polar(220, 220, 94, this.lonToAngle(sky[tp].longitude, ascLon)),
            p2: this.polar(220, 220, 94, this.lonToAngle(chart.placements[np].longitude, ascLon)),
            strokeColor: isHard ? '#FF7A2F' : hit.aspect === 'Trine' ? '#B8FF3B' : '#38BDF8',
            isHighlighted: !focused || focused === tp || focused === np,
          });
        }
      }
    }
    return chords.slice(0, 14);
  });

  readonly natalNodes = computed(() => {
    const chart = this.natalChartSignal();
    if (!chart) return [];
    const ascLon = chart.placements.Ascendant.longitude;
    const focused = this.focusedPlanetSignal();
    const spread = this.spreadAngles(
      this.ringPlanets.map((planet) => ({
        id: planet,
        angle: this.lonToAngle(chart.placements[planet].longitude, ascLon),
      })),
      11
    );

    return this.ringPlanets.map((planet) => {
      const placement = chart.placements[planet];
      const trueAngle = this.lonToAngle(placement.longitude, ascLon);
      return {
        planet,
        glyph: PLANET_GLYPHS[planet],
        isChiron: planet === 'Chiron',
        isSelected: focused === planet,
        pMark: this.polar(220, 220, 96, trueAngle),
        pGlyph: this.polar(220, 220, 124, spread[planet]),
        tooltip: `Natal ${PLANET_LABELS[planet]}: ${formatDegree(placement.degree)} ${placement.sign} (House ${placement.house})`,
      };
    });
  });

  readonly transitNodes = computed(() => {
    const chart = this.natalChartSignal();
    if (!chart) return [];
    const sky = getSkyPositions(this.selectedDateSignal(), 12);
    const ascLon = chart.placements.Ascendant.longitude;
    const focused = this.focusedPlanetSignal();
    const spread = this.spreadAngles(
      this.ringPlanets.map((planet) => ({
        id: planet,
        angle: this.lonToAngle(sky[planet].longitude, ascLon),
      })),
      10
    );

    return this.ringPlanets.map((planet) => {
      const pos = sky[planet];
      const trueAngle = this.lonToAngle(pos.longitude, ascLon);
      return {
        planet,
        glyph: PLANET_GLYPHS[planet],
        isHighlighted: pos.retrograde || planet === 'Chiron' || planet === 'Saturn' || planet === 'Uranus',
        isSelected: focused === planet,
        pTick: this.polar(220, 220, 180, trueAngle),
        pGlyph: this.polar(220, 220, 192, spread[planet]),
        tooltip: `Transit ${PLANET_LABELS[planet]}: ${formatDegree(pos.degree)} ${pos.sign}${pos.retrograde ? ' (Rx)' : ''}`,
      };
    });
  });

  togglePlanet(planet: PlanetId): void {
    this.planetSelected.emit(this.focusedPlanetSignal() === planet ? null : planet);
  }

  private lonToAngle(lon: number, ascLon: number): number {
    return normDeg(180 - (lon - ascLon));
  }

  private polar(cx: number, cy: number, radius: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  private spreadAngles(items: { id: PlanetId; angle: number }[], minSep: number): Record<PlanetId, number> {
    const sorted = [...items].sort((a, b) => a.angle - b.angle);
    const placed = sorted.map((it) => ({ ...it, display: it.angle }));
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < placed.length; i++) {
        const curr = placed[i];
        const next = placed[(i + 1) % placed.length];
        let diff = next.display - curr.display;
        if (i === placed.length - 1) diff += 360;
        if (diff < minSep) {
          const push = (minSep - diff) / 2;
          curr.display = normDeg(curr.display - push);
          next.display = normDeg(next.display + push);
        }
      }
    }
    const map = {} as Record<PlanetId, number>;
    placed.forEach((p) => (map[p.id] = p.display));
    return map;
  }
}