import { AuditEvent } from '../models';
import type { ClientSession } from 'mongoose';

export async function appendAudit(input: {
  actorId: string;
  familyId?: string;
  subjectId?: string;
  eventType: string;
  requestId: string;
  details?: Record<string, string | number | boolean | null>;
}, session?: ClientSession): Promise<void> {
  const options = session ? { session } : undefined;
  await AuditEvent.create([{
    actorId: input.actorId,
    ...(input.familyId ? { familyId: input.familyId } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    eventType: input.eventType,
    requestId: input.requestId,
    occurredAt: new Date(),
    details: input.details ?? {},
  }], options);
}
