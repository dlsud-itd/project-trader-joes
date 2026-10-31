import {
  RequirementMatch,
  RequirementMatchLevel,
} from './ai-screenings.models';
import { clampScore, countMatches, FitTier, fitTier } from './fit-score';

const match = (level: RequirementMatchLevel): RequirementMatch => ({
  requirement: 'Angular',
  match: level,
  evidence: '',
});

describe('fitTier', () => {
  it('uses the mockup bands: 80+ strong, 60–79 possible, under 60 weak', () => {
    expect(fitTier(100)).toBe(FitTier.STRONG);
    expect(fitTier(80)).toBe(FitTier.STRONG);
    expect(fitTier(79)).toBe(FitTier.POSSIBLE);
    expect(fitTier(60)).toBe(FitTier.POSSIBLE);
    expect(fitTier(59)).toBe(FitTier.WEAK);
    expect(fitTier(0)).toBe(FitTier.WEAK);
  });
});

describe('clampScore', () => {
  it('keeps scores whole and inside 0–100', () => {
    expect(clampScore(87.4)).toBe(87);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe('countMatches', () => {
  it('counts each match level', () => {
    expect(
      countMatches([
        match(RequirementMatchLevel.MET),
        match(RequirementMatchLevel.MET),
        match(RequirementMatchLevel.PARTIAL),
        match(RequirementMatchLevel.MISSING),
      ]),
    ).toEqual({ met: 2, partial: 1, missing: 1, total: 4 });
  });

  it('treats a missing list as empty', () => {
    expect(countMatches(null)).toEqual({
      met: 0,
      partial: 0,
      missing: 0,
      total: 0,
    });
  });
});
