import { Inject, Injectable } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import {
  ACTION_GUARDS,
  DomainError,
  allowedEvents,
  authorize,
  transition,
  type Actor,
  type RequestEvent,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { parse } from '../common/zod.js';
import { REPOS, type JobStamp, type Repos } from '../repos.js';
import { RequestsService } from '../requests/requests.service.js';

const isUuid = (s: string) => z.uuid().safeParse(s).success;
const ProblemSchema = z.object({
  reason: z.string().trim().max(100).optional(),
  description: z.string().trim().min(5).max(1000),
});

interface Step {
  guard: string;
  event: RequestEvent;
  role: 'ENGINEER' | 'CUSTOMER';
  code: string;
  stamp: JobStamp;
}
const STEPS = {
  startTrip: {
    guard: 'startTrip',
    event: 'START_TRIP',
    role: 'ENGINEER',
    code: 'TRIP_STARTED',
    stamp: 'startedTripAt',
  },
  arrive: {
    guard: 'arrive',
    event: 'ARRIVE',
    role: 'ENGINEER',
    code: 'ARRIVED',
    stamp: 'arrivedAt',
  },
  start: {
    guard: 'startJob',
    event: 'START_JOB',
    role: 'ENGINEER',
    code: 'JOB_STARTED',
    stamp: 'startedAt',
  },
  complete: {
    guard: 'completeJob',
    event: 'COMPLETE_JOB',
    role: 'ENGINEER',
    code: 'JOB_COMPLETED',
    stamp: 'completedAt',
  },
  confirmCompletion: {
    guard: 'confirmCompletion',
    event: 'CONFIRM_COMPLETION',
    role: 'CUSTOMER',
    code: 'COMPLETION_CONFIRMED',
    stamp: 'confirmedByCustomerAt',
  },
} as const satisfies Record<string, Step>;
export type StepName = keyof typeof STEPS;

@Injectable()
export class JobsService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(RequestsService) private readonly requests: RequestsService,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  async get(actor: Actor, jobId: string) {
    const permission =
      actor.role === 'CUSTOMER'
        ? 'jobs.read.own'
        : actor.role === 'ENGINEER'
          ? 'jobs.read.assigned'
          : 'jobs.read';
    const job = await this.findJob(actor, jobId, { permission });
    const detail = await this.requests.fullDetail(job.agg, actor.role);
    return { data: { ...detail, id: job.job.id, requestId: detail.id } };
  }

  async step(actor: Actor, jobId: string, name: StepName, ctx: AuditCtx) {
    const s: Step = STEPS[name];
    const guard = ACTION_GUARDS[s.guard]!;
    const { job, agg } = await this.findJob(actor, jobId, guard);
    const to = transition(agg.request.status, s.event, s.role);
    if (name === 'complete') {
      const quotes = await this.repos.quotes.list(agg.request.id);
      if (quotes.some((q) => q.kind === 'ADDITIONAL' && q.status === 'SENT'))
        throw new DomainError('PENDING_ADDITIONAL_QUOTE');
    }
    const ok = await this.repos.requests.apply(agg.request.id, {
      expectedVersion: agg.request.version,
      from: agg.request.status,
      to,
      jobStamp: s.stamp,
      event: { code: s.code, actorId: actor.id, actorRole: s.role },
    });
    if (!ok) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: s.code,
      requestId: agg.request.id,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.repos.audit.record({
      ...ctx,
      action: `job.${s.code.toLowerCase()}`,
      entityType: 'Job',
      entityId: job.id,
      before: { status: agg.request.status },
      after: { status: to },
    });
    return {
      data: {
        requestId: agg.request.id,
        jobId: job.id,
        status: to,
        availableActions: allowedEvents(to, s.role),
      },
    };
  }

  async reportProblem(actor: Actor, jobId: string, body: unknown, ctx: AuditCtx) {
    const v = parse(ProblemSchema, body);
    const { job } = await this.findJob(actor, jobId, ACTION_GUARDS['reportProblem']!);
    const d = await this.repos.jobs.openDispute({
      jobId: job.id,
      userId: actor.id,
      reason: v.reason ?? 'PROBLEM_REPORTED',
      description: v.description,
    });
    await this.events.publish({
      type: 'DISPUTE_OPENED',
      requestId: job.requestId,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.repos.audit.record({
      ...ctx,
      action: 'dispute.open',
      entityType: 'Dispute',
      entityId: d.id,
      after: { jobId: job.id },
    });
    return { data: { id: d.id } };
  }

  /** Permission → job exists → ownership (404) → state, using the request the job belongs to. */
  private async findJob(
    actor: Actor,
    jobId: string,
    guard: Parameters<RequestsService['load']>[2],
  ) {
    authorize(actor, guard);
    const job = isUuid(jobId) ? await this.repos.jobs.get(jobId) : null;
    if (!job) throw new DomainError('NOT_FOUND');
    const agg = await this.requests.load(actor, job.requestId, guard);
    return { job, agg };
  }
}
