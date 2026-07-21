import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeePolicyAssignment } from './entities/employee-policy-assignment.entity';
import { Country } from '../countries/entities/country.entity';
import { Division } from '../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { LeavePolicy } from '../policies/entities/leave-policy.entity';
import { LeaveBalance } from '../leave-balances/entities/leave-balance.entity';
import { LeaveLedgerEntry } from '../leave-balances/entities/leave-ledger-entry.entity';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeePolicyAssignment,
      Country,
      Division,
      ApprovalWorkflow,
      LeavePolicy,
      LeaveBalance,
      LeaveLedgerEntry,
    ]),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService, TypeOrmModule],
})
export class EmployeesModule {}
