import { describe, it, expect } from 'vitest';
import {
  recommend,
  isEligible,
  validateWeights,
  DEFAULT_WEIGHTS,
  toPublicRecommendation,
  Candidate,
  DomainError,
  assertStillEligible,
} from '../src/index';

const base: Candidate = {
  engineerId: 'e',
  accountActive: true,
  verified: true,
  serviceIds: ['cctv'],
  subServices: null,
  availability: 'AVAILABLE',
  serviceRadiusKm: 15,
  distanceKm: 2,
  ratingAverage: 4.8,
  experienceYears: 9,
  completedJobs: 100,
};
const req = { serviceId: 'cctv', excludedEngineerIds: [] as string[] };

describe('matching', () => {
  it('eligibility gates come before ranking', () => {
    const bad: Candidate[] = [
      { ...base, engineerId: 'suspended', accountActive: false },
      { ...base, engineerId: 'unverified', verified: false },
      { ...base, engineerId: 'wrong-service', serviceIds: ['sat'] },
      { ...base, engineerId: 'offline', availability: 'OFFLINE' },
      { ...base, engineerId: 'far', distanceKm: 40 },
      { ...base, engineerId: 'rejected' },
    ];
    const out = recommend([...bad, { ...base, engineerId: 'ok' }], {
      ...req,
      excludedEngineerIds: ['rejected'],
    });
    expect(out.map((r) => r.engineerId)).toEqual(['ok']);
  });
  it('a perfect-rated engineer who is not eligible never appears', () => {
    expect(isEligible({ ...base, ratingAverage: 5, verified: false }, req)).toBe(false);
  });
  it('BUSY engineers stay eligible but rank below AVAILABLE ones, all else equal', () => {
    const out = recommend(
      [
        { ...base, engineerId: 'busy', availability: 'BUSY' },
        { ...base, engineerId: 'free' },
      ],
      req,
    );
    expect(out.map((r) => r.engineerId)).toEqual(['free', 'busy']);
  });
  it('closer wins when the rest is equal; ties are deterministic', () => {
    const out = recommend(
      [
        { ...base, engineerId: 'b', distanceKm: 8 },
        { ...base, engineerId: 'a', distanceKm: 1 },
      ],
      req,
    );
    expect(out[0]?.engineerId).toBe('a');
    const t = recommend(
      [
        { ...base, engineerId: 'z' },
        { ...base, engineerId: 'y' },
      ],
      req,
    );
    expect(t.map((r) => r.engineerId)).toEqual(['y', 'z']);
  });
  it('sub-service mismatch is penalised, not excluded', () => {
    const out = recommend(
      [
        { ...base, engineerId: 'narrow', subServices: ['صيانة'] },
        { ...base, engineerId: 'broad' },
      ],
      { ...req, subService: 'تركيب' },
    );
    expect(out.map((r) => r.engineerId)).toEqual(['broad', 'narrow']);
  });
  it('public shape has no score', () => {
    const [r] = recommend([base], req);
    expect(Object.keys(toPublicRecommendation(r!))).not.toContain('_score');
    expect(r!.reasons).toEqual(['NEARBY', 'TOP_RATED', 'AVAILABLE_NOW']);
  });
  it('weights must total 100', () => {
    expect(() => validateWeights(DEFAULT_WEIGHTS)).not.toThrow();
    expect(() => validateWeights({ ...DEFAULT_WEIGHTS, rating: 20 })).toThrow();
  });
  it('re-checks eligibility at selection time', () => {
    expect(() => assertStillEligible({ ...base, availability: 'OFFLINE' }, req)).toThrowError(
      DomainError,
    );
    expect(() => assertStillEligible(undefined, req)).toThrow();
  });
});
