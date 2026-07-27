import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveLedgerEntry } from './entities/leave-ledger-entry.entity';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveBalance,
      LeaveLedgerEntry,
      Employee,
      LeaveType,
    ]),
  ],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService],
  exports: [LeaveBalancesService, TypeOrmModule],
})
export class LeaveBalancesModule {}
