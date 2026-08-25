import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Param,
  Put,
  Patch,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
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
    @Body() dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; reason?: string },
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.create(employeeId, dto);
  }

  // --- STATIC & PREFIX ROUTES MUST BE REGISTERED BEFORE DYNAMIC :id ROUTES ---

  @Get('my-approvals')
  @ApiOperation({ summary: 'Get active workflow approvals pending for the current employee' })
  getMyApprovals(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getMyApprovals(employeeId);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get leave requests for the logged-in employee' })
  getMyRequests(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.findMyRequests(employeeId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Alias for my-requests' })
  getMy(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.findMyRequests(employeeId);
  }

  @Get('whos-out')
  @ApiOperation({ summary: 'Get active leave requests for Who is Out dashboard section' })
  getWhosOut() {
    return this.service.getWhosOut();
  }

  @Get('calendar')
  @ApiOperation({
    summary:
      'Scoped Full Calendar data (employees + absences). MANAGER defaults to team scope, optional ?scope=all retrieves company-wide calendar.',
  })
  getCalendar(
    @Headers('x-employee-id') actorId: string,
    @Query('scope') scope?: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getCalendarData(actorId, scope);
  }

  @Get('hr')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all leave requests for HR' })
  hrFindAll(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.hrFindAll(query, actorId);
  }

  @Put('hr/:id/approve')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Approve a leave request directly (HR Override)' })
  hrApprove(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string,
  ) {
    if (!reviewerId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrApprove(id, reviewerId);
  }

  @Put('hr/:id/reject')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Reject a leave request directly (HR Override)' })
  hrReject(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!reviewerId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrReject(id, reviewerId, reason);
  }

  @Put('hr/:id/delete')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'HR deletes a leave request regardless of status; kept visible as DELETED_BY_HR' })
  hrDelete(
    @Headers('x-employee-id') actorId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrDelete(id, actorId, reason);
  }

  // --- DYNAMIC :id ROUTES ---

  @Get(':id/approval-progress')
  @ApiOperation({ summary: 'Get detailed approval progress timeline for a leave request' })
  getApprovalProgress(
    @Headers('x-employee-id') employeeId: string,
    @Param('id') id: string,
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getApprovalProgress(id, employeeId);
  }

  @Get('team-availability/overview')
  @ApiOperation({
    summary: 'Team availability overview for a manager across a date range',
  })
  getTeamAvailabilityOverview(
    @Headers('x-employee-id') actorId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getTeamAvailabilityOverview(actorId, dateFrom, dateTo);
  }

  @Get(':id/team-availability')
  @ApiOperation({
    summary:
      "Team availability for a request's period (requester's teammates already on/pending leave), scoped to the requester's manager or HR override",
  })
  getTeamAvailability(
    @Headers('x-employee-id') actorId: string,
    @Param('id') id: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.getTeamAvailability(id, actorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific leave request by ID with ownership check' })
  findOne(
    @Headers('x-employee-id') employeeId: string,
    @Param('id') id: string,
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.findOneWithOwnership(id, employeeId);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve the current pending step of a leave request' })
  approve(
    @Headers('x-employee-id') actorId: string,
    @Param('id') id: string,
    @Body('comment') comment?: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.approveStep(id, actorId, comment);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject the current pending step of a leave request' })
  reject(
    @Headers('x-employee-id') actorId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.rejectStep(id, actorId, reason);
  }

  @Patch(':id/cancel')
  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or approved leave request' })
  cancel(
    @Headers('x-employee-id') employeeId: string,
    @Param('id') id: string,
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.cancel(employeeId, id);
  }
}
