import { buildAuditDescription } from './audit-logs.service';
import { AuditActionType } from '../../common/enums';

describe('buildAuditDescription', () => {
  // ── Employees ──────────────────────────────────────────────────────────────

  describe('EMPLOYEE_CREATED', () => {
    it('should describe adding a new employee', () => {
      const result = buildAuditDescription({
        actorName: 'Maram Beji',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_CREATED,
        entityType: 'Employee',
        newValues: { fullName: 'Ahmed Ben Ali', email: 'ahmed@company.com' },
      });
      expect(result).toBe('HR Admin Maram Beji created a new employee "Ahmed Ben Ali".\n\nChanges:\n- Full name: Not set → Ahmed Ben Ali\n- Email: Not set → ahmed@company.com');
    });
  });

  describe('EMPLOYEE_UPDATED', () => {
    it('should describe single/multiple field changes with old and new values', () => {
      const result = buildAuditDescription({
        actorName: 'Salim',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_UPDATED,
        entityType: 'Employee',
        oldValues: { fullName: 'Ahmed Ben Ali', phone: '56269609' },
        newValues: { fullName: 'Salim 1', phone: '56269' },
      });
      expect(result).toContain('HR Admin Salim updated employee "Salim 1".');
      expect(result).toContain('- Full name: Ahmed Ben Ali → Salim 1');
      expect(result).toContain('- Phone: 56269609 → 56269');
    });

    it('should show country and manager changes correctly', () => {
      const result = buildAuditDescription({
        actorName: 'Salim',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_UPDATED,
        entityType: 'Employee',
        oldValues: { fullName: 'Salim', country: 'Lebanon', manager: 'Ahmed Ali' },
        newValues: { fullName: 'Salim', country: 'Tunisia', manager: 'Maram Benji' },
      });
      expect(result).toContain('HR Admin Salim updated employee "Salim".');
      expect(result).toContain('- Country: Lebanon → Tunisia');
      expect(result).toContain('- Manager: Ahmed Ali → Maram Benji');
    });

    it('should show manager removal or adding correctly', () => {
      const result = buildAuditDescription({
        actorName: 'Salim',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_UPDATED,
        entityType: 'Employee',
        oldValues: { fullName: 'Salim', manager: 'Ahmed Ali' },
        newValues: { fullName: 'Salim', manager: null },
      });
      expect(result).toContain('- Manager: Ahmed Ali → Not set');
    });

    it('should show country code changes matching isUuid or null normalize rules', () => {
      const result = buildAuditDescription({
        actorName: 'Salim',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_UPDATED,
        entityType: 'Employee',
        oldValues: { fullName: 'Salim', country: null },
        newValues: { fullName: 'Salim', country: 'Tunisia' },
      });
      expect(result).toContain('- Country: Not set → Tunisia');
    });
  });

  describe('EMPLOYEE_DELETED', () => {
    it('should describe deleting an employee', () => {
      const result = buildAuditDescription({
        actorName: 'Dali',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.EMPLOYEE_DELETED,
        entityType: 'Employee',
        oldValues: { fullName: 'Ahmed Ben Ali' },
      });
      expect(result).toBe('HR Admin Dali deleted employee "Ahmed Ben Ali".');
    });
  });

  // ── Leave Requests ─────────────────────────────────────────────────────────

  describe('LEAVE_REQUEST_APPROVED', () => {
    it('should describe manager approving a leave request', () => {
      const result = buildAuditDescription({
        actorName: 'Maram',
        actorRole: 'MANAGER',
        actionType: AuditActionType.LEAVE_REQUEST_APPROVED,
        entityType: 'LeaveRequest',
        newValues: {
          leaveType: { label: 'Annual Leave' },
          employee: { fullName: 'Salim' },
        },
      });
      expect(result).toBe('Manager Maram approved a Annual Leave request for Salim.');
    });
  });

  describe('LEAVE_REQUEST_REJECTED', () => {
    it('should describe rejection with reason', () => {
      const result = buildAuditDescription({
        actorName: 'Maram',
        actorRole: 'MANAGER',
        actionType: AuditActionType.LEAVE_REQUEST_REJECTED,
        entityType: 'LeaveRequest',
        newValues: {
          leaveType: { label: 'Sick Leave' },
          employee: { fullName: 'Salim' },
        },
        reason: 'Insufficient team coverage',
      });
      expect(result).toBe(
        'Manager Maram rejected a Sick Leave request for Salim — reason: Insufficient team coverage.',
      );
    });
  });

  // ── Approval Workflows ─────────────────────────────────────────────────────

  describe('WORKFLOW_CREATED', () => {
    it('should describe workflow creation with country and leave type', () => {
      const result = buildAuditDescription({
        actorName: 'Maram',
        actorRole: 'HR_ADMIN',
        actionType: AuditActionType.WORKFLOW_CREATED,
        entityType: 'ApprovalWorkflow',
        newValues: {
          name: 'Tunisia Annual Leave Workflow',
          country: { name: 'Tunisia' },
          leaveType: { label: 'Annual Leave' },
        },
      });
      expect(result).toBe('HR Admin Maram created a new approval workflow for Tunisia — Annual Leave.');
    });
  });
});
