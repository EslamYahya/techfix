/**
 * Matching = Eligibility first, Ranking second.
 * In production the candidate set comes from PostGIS (ST_DWithin on engineer_locations.point, see
 * prisma/migrations-notes/postgis.sql); this module is the pure part: gates + score + explanations.
 * The score never leaves the server — the API returns the order and human-readable reasons only.
 */
import { DomainError } from './errors';

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface Weights {
  service: number;
  distance: number;
  availability: number;
  rating: number;
  experience: number;
}
/** Initial formula from Release v1 (35/25/15/15/10). Admin-tunable, must sum to 100. */
export const DEFAULT_WEIGHTS: Weights = { service: 35, distance: 25, availability: 15, rating: 15, experience: 10 };

export interface Candidate {
  engineerId: string;
  accountActive: boolean;
  verified: boolean;
  serviceIds: string[];
  /** Optional narrower specialisation (sub-service labels). null = does all sub-services. */
  subServices: string[] | null;
  availability: AvailabilityStatus;
  serviceRadiusKm: number;
  distanceKm: number; // from PostGIS
  ratingAverage: number; // 0..5
  experienceYears: number;
  completedJobs: number;
}
export interface MatchRequest {
  serviceId: string;
  subService?: string | null;
  excludedEngineerIds: string[]; // rejected / timed out / changed by customer
}
export interface Recommendation {
  engineerId: string;
  distanceKm: number;
  etaMinutes: number;
  reasons: ('NEARBY' | 'TOP_RATED' | 'AVAILABLE_NOW' | 'EXPERIENCED')[];
  /** internal only — strip before serialising */
  _score: number;
}

export function validateWeights(w: Weights): void {
  const sum = w.service + w.distance + w.availability + w.rating + w.experience;
  if (Object.values(w).some((v) => v < 0 || !Number.isFinite(v)) || sum !== 100) {
    throw new Error('Weights must be non-negative and sum to 100');
  }
}

export function isEligible(c: Candidate, r: MatchRequest): boolean {
  return (
    c.accountActive &&
    c.verified &&
    c.serviceIds.includes(r.serviceId) &&
    c.availability !== 'OFFLINE' &&
    !r.excludedEngineerIds.includes(c.engineerId) &&
    c.distanceKm <= c.serviceRadiusKm
  );
}

export function scoreOf(c: Candidate, r: MatchRequest, w: Weights = DEFAULT_WEIGHTS): number {
  const total = w.service + w.distance + w.availability + w.rating + w.experience || 1;
  const parts = {
    service: r.subService && c.subServices && !c.subServices.includes(r.subService) ? 0.7 : 1,
    distance: Math.max(0, 1 - c.distanceKm / Math.max(c.serviceRadiusKm, 1)),
    availability: c.availability === 'AVAILABLE' ? 1 : 0.5,
    rating: Math.min(Math.max(c.ratingAverage / 5, 0), 1),
    experience: Math.min(c.experienceYears / 10, 1),
  };
  return (
    (parts.service * w.service + parts.distance * w.distance + parts.availability * w.availability +
      parts.rating * w.rating + parts.experience * w.experience) / total
  );
}

export function recommend(candidates: Candidate[], r: MatchRequest, w: Weights = DEFAULT_WEIGHTS, limit = 10): Recommendation[] {
  return candidates
    .filter((c) => isEligible(c, r))
    .map((c) => {
      const reasons: Recommendation['reasons'] = [];
      if (c.distanceKm < 3) reasons.push('NEARBY');
      if (c.ratingAverage >= 4.8) reasons.push('TOP_RATED');
      if (c.availability === 'AVAILABLE') reasons.push('AVAILABLE_NOW');
      if (c.experienceYears >= 8) reasons.push('EXPERIENCED');
      return {
        engineerId: c.engineerId,
        distanceKm: Math.round(c.distanceKm * 10) / 10,
        etaMinutes: Math.round(c.distanceKm * 3 + 8),
        reasons: reasons.slice(0, 3),
        _score: scoreOf(c, r, w),
        // tie-break deterministically: closer first, then id
        _tie: c.distanceKm,
      } as Recommendation & { _tie: number };
    })
    .sort((a, b) => b._score - a._score || (a as any)._tie - (b as any)._tie || a.engineerId.localeCompare(b.engineerId))
    .slice(0, limit)
    .map(({ _tie, ...rest }: any) => rest as Recommendation);
}

/** Strip the internal score before the response leaves the server. */
export const toPublicRecommendation = ({ _score, ...pub }: Recommendation) => pub;

/** Re-check at selection time: the list the customer saw may be stale (race). */
export function assertStillEligible(c: Candidate | undefined, r: MatchRequest): asserts c is Candidate {
  if (!c || !isEligible(c, r)) {
    throw new DomainError('ENGINEER_NOT_ELIGIBLE');
  }
}
