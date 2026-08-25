import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { ExpiredRequestsSchedulerService } from './expired-requests-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, ApprovalInstance]),
    LeaveBalancesModule,
    ApprovalWorkflowsModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, ExpiredRequestsSchedulerService],
  exports: [LeaveRequestsService, TypeOrmModule],
})
export class LeaveRequestsModule {}
