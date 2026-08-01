import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { LedgerTransactionType } from '../../../common/enums';

export class LedgerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by employee full name (case-insensitive)' })
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

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsISO8601()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsISO8601()
  @IsOptional()
  dateTo?: string;
}
