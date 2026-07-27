import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/env.config';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { CountriesModule } from './modules/countries/countries.module';
import { DivisionsModule } from './modules/divisions/divisions.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';
import { ApprovalWorkflowsModule } from './modules/approval-workflows/approval-workflows.module';
import { PublicHolidaysModule } from './modules/public-holidays/public-holidays.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { LeaveBalancesModule } from './modules/leave-balances/leave-balances.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(__dirname, '..', '.env'),
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'backend', '.env'),
      ],
      load: [databaseConfig],
      validate,
    }),
    DatabaseModule,
    CountriesModule,
    DivisionsModule,
    LeaveTypesModule,
    ApprovalWorkflowsModule,
    PublicHolidaysModule,
    PoliciesModule,
    EmployeesModule,
    LeaveBalancesModule,
    LeaveRequestsModule,
    AuditLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
