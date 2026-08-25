import { Body, Controller, Get, Headers, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveRemindersService } from './leave-reminders.service';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Leave Reminders')
@Controller({ path: 'reminders', version: '1' })
@UseGuards(AdminGuard)
export class LeaveRemindersController {
  constructor(private readonly service: LeaveRemindersService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get pending-approval reminder settings' })
  getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update pending-approval reminder settings' })
  updateSettings(
    @Body() dto: UpdateReminderSettingsDto,
    @Headers('x-employee-id') actorId: string,
  ) {
    return this.service.updateSettings(dto, actorId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get sent reminder notification history' })
  getHistory(@Query('limit') limit?: string) {
    return this.service.getHistory(limit ? parseInt(limit, 10) : undefined);
  }

  @Post('run')
  @ApiOperation({ summary: 'Manually trigger the reminder check now' })
  runNow() {
    return this.service.runReminderCheck();
  }
}
