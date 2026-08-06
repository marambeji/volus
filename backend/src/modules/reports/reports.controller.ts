import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('requests')
  @ApiOperation({
    summary:
      'Leave requests report, scoped server-side by caller role (HR_ADMIN: company-wide, MANAGER: direct reports, EMPLOYEE: self only)',
  })
  getRequests(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getRequests(actorId, query);
  }

  @Get('balances')
  @ApiOperation({
    summary: 'Leave balances report, scoped server-side by caller role',
  })
  getBalances(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getBalances(actorId, query);
  }

  @Get('overlaps')
  @ApiOperation({
    summary:
      'Overlapping approved leave report, scoped server-side by caller role (not available to EMPLOYEE callers)',
  })
  getOverlaps(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getOverlaps(actorId, query);
  }
}
