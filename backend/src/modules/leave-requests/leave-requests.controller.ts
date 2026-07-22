import { Controller, Post, Body, Headers, UnauthorizedException, Param, Put, Get, Query, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Leave Requests')
@Controller({ path: 'leave-requests', version: '1' })
export class LeaveRequestsController {
  constructor(private readonly service: LeaveRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new leave request' })
  create(
    @Headers('x-employee-id') employeeId: string,
    @Body() dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; reason?: string }
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.create(employeeId, dto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or approved leave request' })
  cancel(
    @Headers('x-employee-id') employeeId: string,
    @Param('id') id: string
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.cancel(employeeId, id);
  }
  @Get('hr')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all leave requests for HR' })
  hrFindAll(@Query() query: any) {
    return this.service.hrFindAll(query);
  }

  @Put('hr/:id/approve')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Approve a leave request (HR)' })
  hrApprove(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string
  ) {
    return this.service.hrApprove(id, reviewerId);
  }

  @Put('hr/:id/reject')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Reject a leave request (HR)' })
  hrReject(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string,
    @Body('reason') reason: string
  ) {
    return this.service.hrReject(id, reviewerId, reason);
  }
}
