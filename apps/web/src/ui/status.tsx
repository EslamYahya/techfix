import { STATUS, statusText, type Role } from '../labels';
import { Chip } from './kit';

/** The status as the given role should read it, in the tone from the design reference. */
export const StatusChip = ({ status, role }: { status: string; role: Role }) => (
  <Chip tone={STATUS[status]?.[2] ?? 'info'}>{statusText(status, role)}</Chip>
);
