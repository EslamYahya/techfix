import { RequestStatus } from './request-state';

const CONFIRMED_OR_LATER: readonly RequestStatus[] = [
  'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'RATED',
];

export interface RequestView {
  area: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  customerPhone?: string;
  customerName: string;
}

/** What the *engineer* may see of the customer. Full address/phone/coordinates only after booking is confirmed. */
export function redactForEngineer(
  status: RequestStatus,
  full: { name: string; phone: string; address: string; area: string; latitude: number; longitude: number },
): RequestView {
  const base = { area: full.area, customerName: full.name.split(' ')[0] ?? '' };
  if (!CONFIRMED_OR_LATER.includes(status)) return base;
  return { ...base, customerName: full.name, address: full.address, latitude: full.latitude, longitude: full.longitude, customerPhone: full.phone };
}

/** Customer sees an engineer's public card; never the exact stored location or phone before confirmation. */
export function redactEngineerForCustomer(
  status: RequestStatus,
  e: { name: string; phone: string; area: string },
): { name: string; area: string; phone?: string } {
  return CONFIRMED_OR_LATER.includes(status) ? { name: e.name, area: e.area, phone: e.phone } : { name: e.name, area: e.area };
}
