import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReminderSettings } from './entities/reminder-settings.entity';
import { LeaveReminderNotification } from './entities/leave-reminder-notification.entity';
import { ApprovalInstance } from '../leave-requests/entities/approval-instance.entity';
import { Employee } from '../employees/entities/employee.entity';
import {
  ApprovalInstanceStatus,
  ApproverType,
  EmployeeRole,
  EmployeeStatus,
  LeaveRequestStatus,
} from '../../common/enums';
import { MailService } from '../mail/mail.service';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';

@Injectable()
export class LeaveRemindersService {
  private readonly logger = new Logger(LeaveRemindersService.name);

  constructor(
    @InjectRepository(ReminderSettings)
    private readonly settingsRepo: Repository<ReminderSettings>,
    @InjectRepository(LeaveReminderNotification)
    private readonly notificationRepo: Repository<LeaveReminderNotification>,
    @InjectRepository(ApprovalInstance)
    private readonly instanceRepo: Repository<ApprovalInstance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly mailService: MailService,
  ) {}

  /** Reminder settings are a single configurable row; it's created lazily on first read. */
  async getSettings(): Promise<ReminderSettings> {
    const [existing] = await this.settingsRepo.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    if (existing) return existing;
    return this.settingsRepo.save(
      this.settingsRepo.create({ enabled: true, delayHours: 48 }),
    );
  }

  async updateSettings(
    dto: UpdateReminderSettingsDto,
    actorId?: string,
  ): Promise<ReminderSettings> {
    const settings = await this.getSettings();
    if (dto.enabled !== undefined) settings.enabled = dto.enabled;
    if (dto.delayHours !== undefined) settings.delayHours = dto.delayHours;
    if (actorId) settings.updatedById = actorId;
    return this.settingsRepo.save(settings);
  }

  async getHistory(limit = 50): Promise<LeaveReminderNotification[]> {
    return this.notificationRepo.find({
      relations: { approver: true, request: { employee: true, leaveType: true } },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  /** Finds approval steps stuck PENDING past the configured delay and emails the current approver(s), skipping anyone already reminded for that step. */
  async runReminderCheck(): Promise<{ checked: number; sent: number }> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      this.logger.log('[Reminders] Disabled — skipping run');
      return { checked: 0, sent: 0 };
    }

    const cutoff = new Date(Date.now() - settings.delayHours * 60 * 60 * 1000);

    const pendingInstances = await this.instanceRepo
      .createQueryBuilder('ai')
      .leftJoinAndSelect('ai.request', 'lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('ai.resolvedApprover', 'approver')
      .where('ai.status = :status', { status: ApprovalInstanceStatus.PENDING })
      .andWhere('lr.status = :reqStatus', { reqStatus: LeaveRequestStatus.PENDING })
      // updatedAt, not createdAt: every step row is bulk-created upfront (steps 2+ start WAITING),
      // and only gets re-saved — bumping updatedAt — when it actually transitions to PENDING.
      .andWhere('ai.updatedAt <= :cutoff', { cutoff })
      .getMany();

    let sent = 0;

    for (const instance of pendingInstances) {
      const approvers = await this.resolveApprovers(instance);

      for (const approver of approvers) {
        const alreadySent = await this.notificationRepo.findOne({
          where: { approvalInstanceId: instance.id, approverId: approver.id },
        });
        if (alreadySent) continue;

        const wasSent = await this.mailService.sendMail(
          approver.email,
          'Reminder: Leave request awaiting your approval',
          this.buildReminderEmail(approver, instance),
        );
        if (!wasSent) continue;

        await this.notificationRepo.save(
          this.notificationRepo.create({
            approvalInstanceId: instance.id,
            requestId: instance.requestId,
            approverId: approver.id,
            approverEmail: approver.email,
            sentAt: new Date(),
          }),
        );
        sent++;
      }
    }

    this.logger.log(
      `[Reminders] Checked ${pendingInstances.length} pending step(s), sent ${sent} reminder(s)`,
    );
    return { checked: pendingInstances.length, sent };
  }

  /** HR steps fan out to every active HR_ADMIN; other step types go to the resolved approver. */
  private async resolveApprovers(instance: ApprovalInstance): Promise<Employee[]> {
    if (instance.approverType === ApproverType.HR) {
      return this.employeeRepo.find({
        where: { role: EmployeeRole.HR_ADMIN, status: EmployeeStatus.ACTIVE },
      });
    }
    if (instance.resolvedApprover) return [instance.resolvedApprover];
    if (instance.resolvedApproverId) {
      const approver = await this.employeeRepo.findOne({
        where: { id: instance.resolvedApproverId },
      });
      return approver ? [approver] : [];
    }
    return [];
  }

  private buildReminderEmail(approver: Employee, instance: ApprovalInstance): string {
    const request = instance.request;
    const employeeName = request?.employee?.fullName || 'An employee';
    const leaveType = request?.leaveType?.label || 'Leave';
    const startDate = request?.startDate || '';
    const endDate = request?.endDate || '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#1e293b;">
        <h2 style="color:#1b2559; margin-bottom: 8px;">Leave Request Awaiting Your Approval</h2>
        <p>Hi ${approver.fullName},</p>
        <p>
          <strong>${employeeName}</strong> submitted a <strong>${leaveType}</strong> request
          (${startDate} &rarr; ${endDate}) that has been pending your approval for a while.
        </p>
        <p>Please log in to the Volus HR Portal to review and take action.</p>
        <p style="color:#94a3b8; font-size:12px; margin-top:24px;">
          This is an automated reminder from Volus HR.
        </p>
      </div>
    `;
  }
}
