import { describe, expect, it } from 'vitest';
import { resolveLocalInput, toLocalInput } from './PostParts';

describe('REQ-84-AC1: minutengenaue Ortszeit', () => {
  it.each([0, 37, 59])('erhält Minute %i beim Speichern und Wiederöffnen', (minute) => {
    const input = '2030-01-17T10:' + String(minute).padStart(2, '0');
    const instant = new Date(2030, 0, 17, 10, minute).toISOString();
    expect(resolveLocalInput(input)).toEqual({ kind: 'ok', iso: instant });
    expect(toLocalInput(instant)).toBe(input);
  });
});

