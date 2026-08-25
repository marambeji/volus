import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveBalancesService } from './leave-balances.service';
import { LedgerHistoryQueryDto } from './dto/ledger-history-query.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Leave Ledger')
@Controller({ path: 'leave-ledger', version: '1' })
export class LeaveLedgerController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Get('history')
  @UseGuards(PermissionGuard)
  @RequireModule('accrualHistory', 'view')
  @ApiOperation({
    summary: 'Get accrual history of all leave transaction records',
  })
  getHistory(@Query() query: LedgerHistoryQueryDto) {
    return this.service.getLedgerHistory(query);
  }
}
