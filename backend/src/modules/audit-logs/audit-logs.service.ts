import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AuditActionType } from '../../common/enums';

// ── Friendly label helpers ────────────────────────────────────────────────────

/** Human-readable role label */
function roleLabel(role: string): string {
  const map: Record<string, string> = {
    HR_ADMIN: 'HR Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
    SYSTEM: 'System',
  };
  return map[role] ?? role;
}

/** Extract the best display name for an entity from its stored values */
function entityName(values: any): string | null {
  if (!values) return null;
  return (
    values.fullName ||
    values.name ||
    values.policyName ||
    values.label ||
    null
  );
}

/** Detect raw UUID strings */
function isUuid(str: any): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ── Employee field labels (human-readable) ──────────────────────────────────

/**
 * Ordered list of employee fields to display in the diff.
 * Fields appear in this order, with the human-readable label shown in the log.
 * Raw FK id fields (managerId, countryId…) are intentionally excluded — we use
 * the resolved name fields instead (manager, country…).
 */
const EMPLOYEE_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'employeeNumber', label: 'Employee number' },
  { key: 'fullName',       label: 'Full name' },
  { key: 'email',          label: 'Email' },
  { key: 'phone',          label: 'Phone' },
  { key: 'jobTitle',       label: 'Job title' },
  { key: 'department',     label: 'Department' },
  { key: 'unit',           label: 'Unit' },
  { key: 'manager',        label: 'Manager' },
  { key: 'country',        label: 'Country' },
  { key: 'division',       label: 'Division' },
  { key: 'approvalWorkflow', label: 'Approval workflow' },
  { key: 'role',           label: 'Role' },
  { key: 'status',         label: 'Status' },
  { key: 'employmentType', label: 'Employment type' },
  { key: 'workMode',       label: 'Work mode' },
  { key: 'hireDate',       label: 'Hire date' },
];

/** Set of raw FK id/technical keys that should be ignored in favour of resolved names */
const SKIP_DIFF_FIELDS = new Set([
  'createdAt', 'updatedAt', 'deletedAt', 'password', 'token',
  'secret', 'document', 'avatar', 'id', 'correlationId',
  'workflowSnapshot', 'approvalInstances',
  // Raw FK ids — we use the resolved name fields instead
  'managerId', 'countryId', 'countryCode', 'divisionId',
  'approvalWorkflowId', 'policyId', 'emergencyContacts',
]);

/** Build a concise human sentence for what fields changed */
function diffSentence(
  changedFields: string[],
  oldValues: any,
  newValues: any,
): string {
  const visible = changedFields.filter((f) => !SKIP_DIFF_FIELDS.has(f));
  if (visible.length === 0) return '';

  if (visible.length === 1) {
    const f = visible[0];
    const oldVal = oldValues?.[f];
    const newVal = newValues?.[f];
    if (oldVal !== undefined && newVal !== undefined) {
      return `changed ${f} from "${oldVal}" to "${newVal}"`;
    }
    return `updated ${f}`;
  }

  if (visible.length <= 3) {
    return (
      'updated fields: ' +
      visible
        .map((f) => {
          const oldVal = oldValues?.[f];
          const newVal = newValues?.[f];
          if (oldVal !== undefined && newVal !== undefined) {
            return `${f} ("${oldVal}" → "${newVal}")`;
          }
          return f;
        })
        .join(', ')
    );
  }

  return `updated ${visible.length} fields: ${visible.slice(0, 3).join(', ')} and ${visible.length - 3} more`;
}

// ── Main description builder ──────────────────────────────────────────────────

/**
 * Build a bullet-point diff block for employee CRUD.
 * Only shows fields that GENUINELY changed.
 * null / undefined / '' / UUID strings are all treated as "Not set" so that
 * loading a previously-unloaded relation does NOT appear as a change.
 *
 * Example output:
 *   \n\nChanges:\n- Full name: Salim → Salim 1\n- Phone: Not set → +216 20 123 456
 */
function buildEmployeeDiff(oldValues: any, newValues: any): string {
  /** Normalize any "empty" value to the same sentinel string */
  const normalize = (v: any): string => {
    if (v === null || v === undefined) return '__EMPTY__';
    if (typeof v === 'string' && v.trim() === '') return '__EMPTY__';
    if (isUuid(v)) return '__EMPTY__';          // raw UUID → treat as empty
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  /** Pretty label for the diff line */
  const formatVal = (v: any): string => {
    const n = normalize(v);
    if (n === '__EMPTY__') return 'Not set';
    return n;
  };

  const lines: string[] = [];
  for (const { key, label } of EMPLOYEE_FIELD_LABELS) {
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];

    // Only emit a line when the normalized values truly differ
    if (normalize(oldVal) !== normalize(newVal)) {
      lines.push(`- ${label}: ${formatVal(oldVal)} → ${formatVal(newVal)}`);
    }
  }

  if (lines.length === 0) return '';
  return '\n\nChanges:\n' + lines.join('\n');
}

export function buildAuditDescription(params: {
  actorName: string;
  actorRole: string;
  actionType: AuditActionType;
  entityType: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[] | null;
  reason?: string;
}): string {
  const { actorName, actorRole, actionType, entityType, oldValues, newValues, changedFields, reason } = params;
  const actor = `${roleLabel(actorRole)} ${actorName}`;
  const targetName = entityName(newValues) ?? entityName(oldValues);
  const nameStr = targetName ? ` "${targetName}"` : '';
  const reasonStr = reason ? ` — reason: ${reason}` : '';

  switch (actionType) {
    // ── Employees ──────────────────────────────────────────────────────────
    case AuditActionType.EMPLOYEE_CREATED: {
      const diff = buildEmployeeDiff(null, newValues);
      return `${actor} created a new employee${nameStr}.${diff}`;
    }

    case AuditActionType.EMPLOYEE_UPDATED: {
      const diff = buildEmployeeDiff(oldValues, newValues);
      return `${actor} updated employee${nameStr}.${diff}`;
    }

    case AuditActionType.EMPLOYEE_DELETED:
      return `${actor} deleted employee${nameStr}.`;

    // ── Leave Requests ─────────────────────────────────────────────────────
    case AuditActionType.LEAVE_REQUEST_SUBMITTED: {
      let leaveType = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      if (isUuid(leaveType)) leaveType = 'leave';
      const start = newValues?.startDate ?? '';
      const end = newValues?.endDate ?? '';
      const dateStr = start ? ` from ${start} to ${end}` : '';
      return `${actor} submitted a ${leaveType} request${dateStr}.`;
    }

    case AuditActionType.LEAVE_REQUEST_APPROVED: {
      let leaveType = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      if (isUuid(leaveType)) leaveType = 'leave';
      const empName = newValues?.employee?.fullName ?? newValues?.employeeName ?? '';
      const empStr = empName ? ` for ${empName}` : '';
      return `${actor} approved a ${leaveType} request${empStr}${reasonStr}.`;
    }

    case AuditActionType.LEAVE_REQUEST_REJECTED: {
      let leaveType = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      if (isUuid(leaveType)) leaveType = 'leave';
      const empName = newValues?.employee?.fullName ?? newValues?.employeeName ?? '';
      const empStr = empName ? ` for ${empName}` : '';
      return `${actor} rejected a ${leaveType} request${empStr}${reasonStr}.`;
    }

    case AuditActionType.LEAVE_REQUEST_CANCELLED: {
      let leaveType = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      if (isUuid(leaveType)) leaveType = 'leave';
      return `${actor} cancelled a ${leaveType} request${reasonStr}.`;
    }

    case AuditActionType.LEAVE_REQUEST_DELETED_BY_HR: {
      let leaveType = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      if (isUuid(leaveType)) leaveType = 'leave';
      const empName = newValues?.employee?.fullName ?? newValues?.employeeName ?? '';
      const empStr = empName ? ` for ${empName}` : '';
      return `${actor} deleted a ${leaveType} request${empStr}${reasonStr}.`;
    }

    // ── Approval Steps ─────────────────────────────────────────────────────
    case AuditActionType.APPROVAL_STEP_APPROVED:
      return `${actor} approved an approval step${reasonStr}.`;

    case AuditActionType.APPROVAL_STEP_REJECTED:
      return `${actor} rejected an approval step${reasonStr}.`;

    case AuditActionType.APPROVAL_STEP_SKIPPED:
      return `${actor} skipped an optional approval step.`;

    // ── Workflows ──────────────────────────────────────────────────────────
    case AuditActionType.WORKFLOW_CREATED: {
      const wfName = newValues?.name ?? '';
      const country = newValues?.country?.name ?? '';
      const lt = newValues?.leaveType?.label ?? '';
      const ctx = country && lt ? ` for ${country} — ${lt}` : wfName ? ` '${wfName}'` : '';
      return `${actor} created a new approval workflow${ctx}.`;
    }

    case AuditActionType.WORKFLOW_UPDATED: {
      const wfName = newValues?.name ?? oldValues?.name ?? '';
      const nameCtx = wfName ? ` '${wfName}'` : '';
      const fields = changedFields ?? [];
      const diff = fields.length > 0 ? ': ' + diffSentence(fields, oldValues, newValues) : '';
      return `${actor} updated approval workflow${nameCtx}${diff}.`;
    }

    case AuditActionType.WORKFLOW_DELETED: {
      const wfName = oldValues?.name ?? '';
      return `${actor} deleted approval workflow${wfName ? ` '${wfName}'` : ''}.`;
    }

    // ── Leave Balances ─────────────────────────────────────────────────────
    case AuditActionType.BALANCE_ADJUSTED: {
      const lt = newValues?.leaveType?.label ?? newValues?.leaveTypeId ?? 'leave';
      const amount = newValues?.signedAmount ?? newValues?.amount ?? '';
      const amtStr = amount !== '' ? ` by ${amount} day(s)` : '';
      return `${actor} adjusted ${lt} balance${amtStr}${reasonStr}.`;
    }

    case AuditActionType.LEDGER_USAGE_CREATED:
      return `${actor} recorded leave usage in the ledger.`;

    case AuditActionType.LEDGER_REVERSAL_CREATED:
      return `${actor} reversed leave usage in the ledger.`;

    // ── Policies ───────────────────────────────────────────────────────────
    case AuditActionType.POLICY_ASSIGNED: {
      const policyName = newValues?.policyName ?? newValues?.leavePolicyId ?? 'policy';
      return `${actor} assigned policy '${policyName}' to an employee.`;
    }

    default:
      return `${actor} performed action ${(actionType as string).toLowerCase().replace(/_/g, ' ')} on ${entityType}${nameStr}.`;
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async log(
    actorId: string | null,
    actionType: AuditActionType,
    entityType: string,
    entityId: string,
    details: {
      oldValues?: any;
      newValues?: any;
      reason?: string;
      correlationId?: string;
    },
    em?: EntityManager,
  ): Promise<AuditLog> {
    let actorName = 'System';
    let actorRole = 'SYSTEM';

    // Validate actorId is a proper UUID before querying
    const validActorId = actorId && isUuid(actorId) ? actorId : null;

    if (validActorId) {
      const repo = em ? em.getRepository(Employee) : this.employeeRepo;
      const employee = await repo.findOne({ where: { id: validActorId } });
      if (employee) {
        actorName = employee.fullName;
        actorRole = employee.role;
      }
    }

    const { oldValues, newValues, reason, correlationId } = details;

    // Detect changed fields if both old and new values are present
    let changedFields: string[] | null = null;
    if (oldValues && newValues) {
      changedFields = [];
      const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
      for (const key of allKeys) {
        if (
          key !== 'createdAt' &&
          key !== 'updatedAt' &&
          JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
        ) {
          changedFields.push(key);
        }
      }
    }

    // Generate human-readable description
    const description = buildAuditDescription({
      actorName,
      actorRole,
      actionType,
      entityType,
      oldValues: oldValues ? this.sanitize(oldValues) : undefined,
      newValues: newValues ? this.sanitize(newValues) : undefined,
      changedFields,
      reason,
    });

    const manager = em ?? this.auditLogRepo.manager;
    const auditLog = manager.create(AuditLog, {
      actorId: validActorId,
      actorName,
      actorRole,
      actionType,
      entityType,
      entityId,
      oldValues: oldValues ? this.sanitize(oldValues) : null,
      newValues: newValues ? this.sanitize(newValues) : null,
      changedFields,
      reason,
      correlationId,
      description,
    });

    return manager.save(AuditLog, auditLog);
  }

  // Fetch audit history for a specific record
  async getHistory(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  // Global log retrieval (for HR/admin views)
  async findAll(query: { entityType?: string; actionType?: AuditActionType }): Promise<AuditLog[]> {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.actionType) where.actionType = query.actionType;
    return this.auditLogRepo.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  // Leave-lifecycle notification types shown to Employees/Managers. HR-only audit
  // trail noise (profile edits, policy assignment, workflow/ledger changes) is
  // intentionally excluded — this feed is scoped to "leave requests concerning me".
  // Intermediate APPROVAL_STEP_* events are excluded too: in the common single-step
  // (or last-step) case they fire in the same transaction as the terminal
  // LEAVE_REQUEST_APPROVED/REJECTED event, so surfacing both reads as a duplicate.
  private static readonly NOTIFIABLE_ACTION_TYPES = [
    AuditActionType.LEAVE_REQUEST_SUBMITTED,
    AuditActionType.LEAVE_REQUEST_APPROVED,
    AuditActionType.LEAVE_REQUEST_REJECTED,
    AuditActionType.LEAVE_REQUEST_CANCELLED,
    AuditActionType.LEAVE_REQUEST_DELETED_BY_HR,
  ];

  // Employee-specific notification logs retrieval.
  // Deliberately NOT matched on actorId: a notification tells you what happened to
  // YOUR request or what needs YOUR review — being told about the click you just
  // made yourself is noise, not a notification.
  // NOTE: the JSONB arrow operator (->>) glued directly onto "al.newValues" defeats
  // TypeORM's camelCase->snake_case alias translation (it requires a word boundary
  // after the property name), so the real column name (new_values) must be used
  // directly here instead of the entity property name.
  async findMyNotifications(employeeId: string): Promise<AuditLog[]> {
    const approverFilter = JSON.stringify([{ resolvedApproverId: employeeId }]);
    return this.auditLogRepo
      .createQueryBuilder('al')
      .where('al.actionType IN (:...relevantTypes)', { relevantTypes: AuditLogsService.NOTIFIABLE_ACTION_TYPES })
      .andWhere(
        new Brackets((qb) => {
          qb.where("al.new_values->>'employeeId' = :employeeId", { employeeId })
            .orWhere("al.new_values->'approvalInstances' @> :approverFilter::jsonb", { approverFilter });
        }),
      )
      .orderBy('al.timestamp', 'DESC')
      .take(30)
      .getMany();
  }

  // Sanitizer to prevent leaking passwords, secrets, or document content
  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));
    const clean = { ...obj };
    const sensitiveKeys = ['password', 'token', 'secret', 'document', 'avatar'];
    for (const key of Object.keys(clean)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        clean[key] = '[REDACTED]';
      } else if (typeof clean[key] === 'object') {
        clean[key] = this.sanitize(clean[key]);
      }
    }
    return clean;
  }
}
