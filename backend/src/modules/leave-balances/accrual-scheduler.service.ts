import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveBalancesService } from './leave-balances.service';

/**
 * AccrualSchedulerService
 *
 * Runs automatically on the 1st of each month at 06:00 AM to process accruals.
 * - MONTHLY rules: processed every month
 * - YEARLY rules: processed only in January
 */
@Injectable()
export class AccrualSchedulerService {
  private readonly logger = new Logger(AccrualSchedulerService.name);

  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  @Cron('0 6 1 * *', { name: 'monthly-accrual', timeZone: 'UTC' })
  async handleMonthlyAccrual() {
    const now = new Date();
    this.logger.log(`[AccrualCron] Starting accrual job for ${now.toISOString()}`);
    try {
      const result = await this.leaveBalancesService.runAccruals(
        now.getMonth() + 1,
        now.getFullYear(),
      );
      this.logger.log(
        `[AccrualCron] Completed — employees: ${result.processedEmployees}, ` +
        `entries created: ${result.accrualEntriesCreated}, ` +
        `skipped: ${result.skipped}, ` +
        `errors: ${result.errors.length}`,
      );
      if (result.errors.length > 0) {
        this.logger.error(`[AccrualCron] Errors: ${JSON.stringify(result.errors)}`);
      }
    } catch (err) {
      this.logger.error(`[AccrualCron] Fatal error: ${err}`);
    }
  }
}
