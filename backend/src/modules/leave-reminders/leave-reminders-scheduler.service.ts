import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveRemindersService } from './leave-reminders.service';

/**
 * LeaveRemindersSchedulerService
 *
 * Runs hourly and emails the current approver of any approval step that has
 * been PENDING longer than the configured delay (see LeaveRemindersService.runReminderCheck).
 */
@Injectable()
export class LeaveRemindersSchedulerService {
  private readonly logger = new Logger(LeaveRemindersSchedulerService.name);

  constructor(private readonly remindersService: LeaveRemindersService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'leave-approval-reminders', timeZone: 'UTC' })
  async handleReminders() {
    this.logger.log('[RemindersCron] Starting pending-approval reminder check');
    try {
      const result = await this.remindersService.runReminderCheck();
      this.logger.log(
        `[RemindersCron] Completed — checked: ${result.checked}, sent: ${result.sent}`,
      );
    } catch (err) {
      this.logger.error(`[RemindersCron] Fatal error: ${err}`);
    }
  }
}
