import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderSettings } from './entities/reminder-settings.entity';
import { LeaveReminderNotification } from './entities/leave-reminder-notification.entity';
import { LeaveRemindersService } from './leave-reminders.service';
import { LeaveRemindersController } from './leave-reminders.controller';
import { LeaveRemindersSchedulerService } from './leave-reminders-scheduler.service';
import { MailModule } from '../mail/mail.module';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';
import { EmployeesModule } from '../employees/employees.module';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReminderSettings, LeaveReminderNotification]),
    LeaveRequestsModule,
    EmployeesModule,
    MailModule,
    HrPermissionsModule,
  ],
  controllers: [LeaveRemindersController],
  providers: [LeaveRemindersService, LeaveRemindersSchedulerService],
  exports: [LeaveRemindersService],
})
export class LeaveRemindersModule {}
