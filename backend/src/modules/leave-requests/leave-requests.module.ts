import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest]),
    LeaveBalancesModule
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  exports: [LeaveRequestsService, TypeOrmModule]
})
export class LeaveRequestsModule {}
