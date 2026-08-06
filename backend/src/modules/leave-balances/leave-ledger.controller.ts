import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveBalancesService } from './leave-balances.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';

@ApiTags('Leave Ledger')
@Controller({ path: 'leave-ledger', version: '1' })
export class LeaveLedgerController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Get('history')
  @ApiOperation({
    summary: 'Get accrual history of all leave transaction records',
  })
  getHistory(@Query() query: LedgerQueryDto) {
    return this.service.findAllLedger(query);
  }
}
