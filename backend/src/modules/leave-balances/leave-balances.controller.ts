import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveBalancesService } from './leave-balances.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Leave Balances')
@Controller({ path: 'leave-balances', version: '1' })
export class LeaveBalancesController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Post('run-accruals')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Manually trigger monthly/yearly leave accruals for all active employees',
  })
  runAccruals(@Body() body?: { month?: number; year?: number }) {
    return this.service.runAccruals(body?.month, body?.year);
  }

  @Get('ledger')
  @ApiOperation({
    summary: 'Query immutable leave ledger entries (audit history)',
  })
  findAllLedger(@Query() query: LedgerQueryDto) {
    return this.service.findAllLedger(query);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get calculated balance records for a given employee' })
  findByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('year') year?: number,
  ) {
    return this.service.calculateBalancesForEmployee(
      employeeId,
      year ? Number(year) : undefined,
    );
  }

  @Post('adjust')
  @ApiOperation({
    summary: 'Perform an atomic manual balance adjustment with ledger entry',
  })
  adjust(@Body() dto: AdjustBalanceDto) {
    return this.service.adjust(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List leave balances with pagination and filters' })
  findAll(@Query() query: BalanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave balance detail by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
}
