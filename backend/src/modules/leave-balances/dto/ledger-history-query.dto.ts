import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { LedgerTransactionType } from '../../../common/enums';

export class LedgerHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by employee name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  leaveTypeId?: string;

  @ApiPropertyOptional({ enum: LedgerTransactionType })
  @IsEnum(LedgerTransactionType)
  @IsOptional()
  transactionType?: LedgerTransactionType;

  @ApiPropertyOptional({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  @IsOptional()
  year?: number;
}
