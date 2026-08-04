import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveRequestsService } from './leave-requests.service';

/**
 * ExpiredRequestsSchedulerService
 *
 * Runs automatically once a day to auto-approve leave requests that have
 * been PENDING for 5 days or more (see LeaveRequestsService.processExpiredRequests).
 */
@Injectable()
export class ExpiredRequestsSchedulerService {
  private readonly logger = new Logger(ExpiredRequestsSchedulerService.name);

  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'auto-approve-expired-requests', timeZone: 'UTC' })
  async handleExpiredRequests() {
    this.logger.log('[ExpiredRequestsCron] Starting expired-request auto-approval job');
    try {
      const result = await this.leaveRequestsService.processExpiredRequests();
      this.logger.log(
        `[ExpiredRequestsCron] Completed — processed: ${result.processedCount}, ` +
        `ids: ${result.autoApprovedIds.join(', ') || 'none'}`,
      );
    } catch (err) {
      this.logger.error(`[ExpiredRequestsCron] Fatal error: ${err}`);
    }
  }
}
