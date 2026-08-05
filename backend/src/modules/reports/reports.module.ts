import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, LeaveRequest]),
    LeaveBalancesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
