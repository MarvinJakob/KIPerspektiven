import { describe, expect, it } from 'vitest';
import { CHART_LEFT, CHART_RIGHT, dayIndexAt, describeDay, formatCount, formatDay, stepIndex } from './chartDays';

// Anforderung #65: Tageswerte direkt in der Grafik der Redaktionsstatistik.
// Die Fidelity-Tests im Browser stehen in app/e2e/tests/65-tageswerte-grafik.spec.ts.

describe('REQ-65-AC2: Tageswerte mit Datum und beiden Bezeichnungen', () => {
  it('formatiert den Kalendertag mit Wochentag wie die bisherige Tabelle, ohne Zeitzonenverschiebung', () => {
    expect(formatDay('2026-11-18')).toBe('Mi., 18.11.2026');
    expect(formatDay('2026-01-01')).toBe('Do., 01.01.2026');
  });

  it('beschreibt einen Tag mit „Absolute Anzahl“ und „Bereinigte Anzahl“', () => {
    expect(describeDay({ date: '2026-11-18', views: 138, uniqueViews: 54 }))
      .toBe('Mi., 18.11.2026: Absolute Anzahl 138, Bereinigte Anzahl 54');
  });

  it('nutzt deutsche Tausendertrennung für große Werte', () => {
    expect(formatCount(12345)).toBe('12.345');
  });
});

describe('REQ-65-AC4: Nullwerte und fehlende Werte unterscheiden', () => {
  it('zeigt einen vorhandenen Nullwert als „0“', () => {
    expect(formatCount(0)).toBe('0');
    expect(describeDay({ date: '2026-11-17', views: 0, uniqueViews: 0 }))
      .toBe('Di., 17.11.2026: Absolute Anzahl 0, Bereinigte Anzahl 0');
  });

  it('zeigt einen fehlenden bereinigten Wert als „Nicht verfügbar“, nicht als 0', () => {
    expect(formatCount(null)).toBe('Nicht verfügbar');
    expect(describeDay({ date: '2026-11-16', views: 7, uniqueViews: null }))
      .toBe('Mo., 16.11.2026: Absolute Anzahl 7, Bereinigte Anzahl Nicht verfügbar');
  });
});

describe('REQ-65-AC2/AC3: Zeigerposition → nächstgelegener Tag', () => {
  const width = 1000;
  const plot = width - CHART_LEFT - CHART_RIGHT;
  const at = (count: number, i: number) => CHART_LEFT + plot * i / (count - 1);

  it('trifft bei 7, 30 und 400 Tagen jeden Tag an seiner Position', () => {
    for (const count of [7, 30, 400]) {
      for (const i of [0, 1, Math.floor(count / 2), count - 2, count - 1]) {
        expect(dayIndexAt(at(count, i), width, count), `${count} Tage, Index ${i}`).toBe(i);
      }
    }
  });

  it('wählt den näheren Nachbartag knapp vor und nach der Mitte zwischen zwei Tagen', () => {
    const mid = (at(30, 10) + at(30, 11)) / 2;
    expect(dayIndexAt(mid - 1, width, 30)).toBe(10);
    expect(dayIndexAt(mid + 1, width, 30)).toBe(11);
  });

  it('begrenzt Positionen links und rechts außerhalb der Zeichenfläche auf den ersten bzw. letzten Tag', () => {
    expect(dayIndexAt(0, width, 30)).toBe(0);
    expect(dayIndexAt(width, width, 30)).toBe(29);
  });

  it('liefert bei nur einem Tag immer diesen Tag', () => {
    expect(dayIndexAt(CHART_LEFT, width, 1)).toBe(0);
    expect(dayIndexAt(width / 2, width, 1)).toBe(0);
  });
});

describe('REQ-65-AC3: Tastaturbedienung', () => {
  it('wechselt mit Pfeil links/rechts zum vorherigen/nächsten Tag', () => {
    expect(stepIndex('ArrowLeft', 5, 30)).toBe(4);
    expect(stepIndex('ArrowRight', 5, 30)).toBe(6);
  });

  it('bleibt an den Rändern auf dem ersten bzw. letzten Tag', () => {
    expect(stepIndex('ArrowLeft', 0, 30)).toBe(0);
    expect(stepIndex('ArrowRight', 29, 30)).toBe(29);
  });

  it('springt mit Pos1/Ende zum ersten/letzten Tag', () => {
    expect(stepIndex('Home', 12, 400)).toBe(0);
    expect(stepIndex('End', 12, 400)).toBe(399);
  });

  it('startet ohne Auswahl mit Pfeiltasten beim neuesten Tag', () => {
    expect(stepIndex('ArrowLeft', null, 7)).toBe(6);
    expect(stepIndex('ArrowRight', null, 7)).toBe(6);
  });

  it('ignoriert andere Tasten', () => {
    expect(stepIndex('a', 3, 7)).toBeNull();
    expect(stepIndex('Tab', 3, 7)).toBeNull();
  });
});
