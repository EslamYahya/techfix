import type { Session } from './http';

export type { Session };

export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  category: { id: string; name: string; slug: string };
}

export interface EngineerMe {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  hasShop: boolean;
  bio: string | null;
  experienceYears: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  availabilityStatus: 'AVAILABLE' | 'OFFLINE' | 'BUSY';
  serviceRadiusKm: number;
  rating: { average: number; count: number };
  completedJobs: number;
  services: ServiceItem[];
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
    area: string | null;
  } | null;
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
  documents: { id: string; kind: string; approved: boolean | null; createdAt: string }[];
}

export interface AdminEngineerRow {
  id: string;
  name: string;
  phone: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  availabilityStatus: 'AVAILABLE' | 'OFFLINE' | 'BUSY';
  documentsCount: number;
}

export interface RequestSummary {
  id: string;
  number: string;
  status: string;
  service: { id: string; name: string; category: string };
  description: string;
  preferredDate: string;
  preferredSlot: string | null;
  area: string;
  createdAt: string;
  engineer?: { name: string } | null;
  customerName?: string;
}

export interface PendingPayment {
  id: string;
  method: 'CASH' | 'ONLINE';
  status: string;
  amount: number;
  reference: string | null;
  expiresAt: string | null;
  paidAt: string | null;
}
export interface PaymentView {
  total: number;
  paid: number;
  due: number;
  state: 'UNPAID' | 'PARTIAL' | 'PAID';
  pending: PendingPayment | null;
}

export interface RequestDetail extends Omit<RequestSummary, 'engineer' | 'customerName'> {
  location: { area: string; address?: string };
  customer: { name: string; phone?: string };
  engineer: { id: string; name: string; area: string; phone?: string } | null;
  cancelReason: string | null;
  quotes: Quote[];
  job: Job | null;
  payment: PaymentView | null;
  review: { rating: number; comment: string | null } | null;
  timeline: { at: string; status: string; code: string; actorRole: string }[];
  availableActions: string[];
}

export interface Recommendation {
  engineerId: string;
  name: string;
  area: string;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  distanceKm: number;
  etaMinutes: number;
  availability: string;
  reasons: string[];
}

export interface QuoteItem {
  type: 'LABOR' | 'MATERIAL' | 'OTHER';
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Quote {
  id: string;
  kind: 'MAIN' | 'ADDITIONAL';
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  items: QuoteItem[];
  subtotal: number;
  total: number;
  estimatedDurationMinutes: number;
  notes: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
}

export interface Job {
  id: string;
  status: string;
  agreedTotal: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { requestId?: string; jobId?: string } | null;
  read: boolean;
  createdAt: string;
}
export interface NotificationMeta {
  nextCursor: string | null;
  unreadCount: number;
}

export interface AdminRequestRow {
  id: string;
  number: string;
  status: string;
  serviceName: string;
  customerName: string;
  engineerName: string | null;
  hasDispute: boolean;
  createdAt: string;
}
export interface AdminPaymentRow {
  id: string;
  requestId: string;
  requestNumber: string;
  method: 'CASH' | 'ONLINE';
  status: string;
  amount: number;
  refunded: number;
  reference: string | null;
  customerName: string;
  engineerName: string | null;
  createdAt: string;
  paidAt: string | null;
}
export interface PaymentTotals {
  collectedNet: number;
  cashNet: number;
  onlineNet: number;
  refundedTotal: number;
  pendingCount: number;
  pendingAmount: number;
}
export interface AdminDisputeRow {
  id: string;
  requestId: string;
  requestNumber: string;
  openedByName: string;
  openedByRole: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}
export interface AdminReviewRow {
  id: string;
  requestNumber: string;
  rating: number;
  comment: string | null;
  hidden: boolean;
  customerName: string;
  engineerName: string;
  createdAt: string;
}
