/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveRemindersService } from './leave-reminders.service';
import { ReminderSettings } from './entities/reminder-settings.entity';
import { LeaveReminderNotification } from './entities/leave-reminder-notification.entity';
import { ApprovalInstance } from '../leave-requests/entities/approval-instance.entity';
import { Employee } from '../employees/entities/employee.entity';
import { MailService } from '../mail/mail.service';
import { ApprovalInstanceStatus, ApproverType, EmployeeRole } from '../../common/enums';

describe('LeaveRemindersService', () => {
  let service: LeaveRemindersService;
  let settingsRepo: any;
  let notificationRepo: any;
  let instanceRepo: any;
  let employeeRepo: any;
  let mailService: { sendMail: jest.Mock };

  beforeEach(async () => {
    settingsRepo = {
      find: jest.fn(),
      save: jest.fn((s) => Promise.resolve(s)),
      create: jest.fn((s) => s),
    };

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    instanceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    notificationRepo = {
      findOne: jest.fn(),
      save: jest.fn((n) => Promise.resolve({ id: 'notif-1', ...n })),
      create: jest.fn((n) => n),
    };

    employeeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mailService = { sendMail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRemindersService,
        { provide: getRepositoryToken(ReminderSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(LeaveReminderNotification), useValue: notificationRepo },
        { provide: getRepositoryToken(ApprovalInstance), useValue: instanceRepo },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<LeaveRemindersService>(LeaveRemindersService);
  });

  describe('getSettings', () => {
    it('creates a default 48h-enabled row when none exists yet', async () => {
      settingsRepo.find.mockResolvedValue([]);

      const result = await service.getSettings();

      expect(settingsRepo.create).toHaveBeenCalledWith({ enabled: true, delayHours: 48 });
      expect(result).toEqual({ enabled: true, delayHours: 48 });
    });

    it('returns the existing row without creating a new one', async () => {
      const existing = { id: 's-1', enabled: false, delayHours: 72 };
      settingsRepo.find.mockResolvedValue([existing]);

      const result = await service.getSettings();

      expect(settingsRepo.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('updateSettings', () => {
    it('updates only the provided fields and records the actor', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: true, delayHours: 48 }]);

      const result = await service.updateSettings({ delayHours: 24 }, 'actor-1');

      expect(result).toMatchObject({ enabled: true, delayHours: 24, updatedById: 'actor-1' });
    });
  });

  describe('runReminderCheck', () => {
    it('skips the run entirely when reminders are disabled', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: false, delayHours: 48 }]);

      const result = await service.runReminderCheck();

      expect(result).toEqual({ checked: 0, sent: 0 });
      expect(instanceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('emails the resolved approver of a stale MANAGER step and logs the notification', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: true, delayHours: 48 }]);
      const approver = { id: 'mgr-1', fullName: 'Maram Beji', email: 'maram@volus.app' };
      const instance = {
        id: 'ai-1',
        requestId: 'req-1',
        approverType: ApproverType.MANAGER,
        resolvedApprover: approver,
        status: ApprovalInstanceStatus.PENDING,
        request: { employee: { fullName: 'Salim' }, leaveType: { label: 'Annual Leave' }, startDate: '2026-08-01', endDate: '2026-08-05' },
      };
      instanceRepo.createQueryBuilder().getMany.mockResolvedValue([instance]);
      notificationRepo.findOne.mockResolvedValue(null);
      mailService.sendMail.mockResolvedValue(true);

      const result = await service.runReminderCheck();

      expect(mailService.sendMail).toHaveBeenCalledWith(
        'maram@volus.app',
        expect.stringContaining('Reminder'),
        expect.stringContaining('Salim'),
      );
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ approvalInstanceId: 'ai-1', approverId: 'mgr-1', approverEmail: 'maram@volus.app' }),
      );
      expect(result).toEqual({ checked: 1, sent: 1 });
    });

    it('fans out HR-type steps to every active HR_ADMIN employee', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: true, delayHours: 48 }]);
      const instance = {
        id: 'ai-2',
        requestId: 'req-2',
        approverType: ApproverType.HR,
        resolvedApprover: null,
        request: { employee: { fullName: 'Yasin' }, leaveType: { label: 'Sick Leave' }, startDate: '2026-08-10', endDate: '2026-08-11' },
      };
      instanceRepo.createQueryBuilder().getMany.mockResolvedValue([instance]);
      employeeRepo.find.mockResolvedValue([
        { id: 'hr-1', fullName: 'HR One', email: 'hr1@volus.app', role: EmployeeRole.HR_ADMIN },
        { id: 'hr-2', fullName: 'HR Two', email: 'hr2@volus.app', role: EmployeeRole.HR_ADMIN },
      ]);
      notificationRepo.findOne.mockResolvedValue(null);
      mailService.sendMail.mockResolvedValue(true);

      const result = await service.runReminderCheck();

      expect(mailService.sendMail).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ checked: 1, sent: 2 });
    });

    it('does not resend to an approver already reminded for that step', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: true, delayHours: 48 }]);
      const approver = { id: 'mgr-1', fullName: 'Maram Beji', email: 'maram@volus.app' };
      const instance = {
        id: 'ai-1',
        requestId: 'req-1',
        approverType: ApproverType.MANAGER,
        resolvedApprover: approver,
        request: { employee: {}, leaveType: {}, startDate: '2026-08-01', endDate: '2026-08-05' },
      };
      instanceRepo.createQueryBuilder().getMany.mockResolvedValue([instance]);
      notificationRepo.findOne.mockResolvedValue({ id: 'notif-existing' });

      const result = await service.runReminderCheck();

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({ checked: 1, sent: 0 });
    });

    it('does not log a notification when the email actually fails to send', async () => {
      settingsRepo.find.mockResolvedValue([{ id: 's-1', enabled: true, delayHours: 48 }]);
      const approver = { id: 'mgr-1', fullName: 'Maram Beji', email: 'maram@volus.app' };
      const instance = {
        id: 'ai-1',
        requestId: 'req-1',
        approverType: ApproverType.MANAGER,
        resolvedApprover: approver,
        request: { employee: {}, leaveType: {}, startDate: '2026-08-01', endDate: '2026-08-05' },
      };
      instanceRepo.createQueryBuilder().getMany.mockResolvedValue([instance]);
      notificationRepo.findOne.mockResolvedValue(null);
      mailService.sendMail.mockResolvedValue(false);

      const result = await service.runReminderCheck();

      expect(notificationRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({ checked: 1, sent: 0 });
    });
  });
});
