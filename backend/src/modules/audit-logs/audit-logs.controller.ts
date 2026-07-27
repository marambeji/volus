import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuditActionType } from '../../common/enums';

@ApiTags('Audit Logs')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get('my-notifications')
  @ApiOperation({ summary: 'Get audit notifications for the authenticated employee' })
  getMyNotifications(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.findMyNotifications(employeeId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get record-level audit history' })
  getHistory(
    @Headers('x-employee-id') employeeId: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getHistory(entityType, entityId);
  }

  @Get('global')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all audit logs (HR only)' })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('actionType') actionType?: AuditActionType,
  ) {
    return this.service.findAll({ entityType, actionType });
  }
}
