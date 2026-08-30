import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('requests')
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
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
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
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
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
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
