import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeavePolicy } from './entities/leave-policy.entity';
import { LeaveRule } from './entities/leave-rule.entity';
import { SeniorityMilestone } from './entities/seniority-milestone.entity';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { CountriesModule } from '../countries/countries.module';
import { DivisionsModule } from '../divisions/divisions.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { LeaveTypesModule } from '../leave-types/leave-types.module';
import { EmployeesModule } from '../employees/employees.module';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeavePolicy, LeaveRule, SeniorityMilestone]),
    CountriesModule,
    DivisionsModule,
    ApprovalWorkflowsModule,
    LeaveTypesModule,
    EmployeesModule,
    HrPermissionsModule,
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
