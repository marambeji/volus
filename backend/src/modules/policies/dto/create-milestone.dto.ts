import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  serviceYearsFrom: number;

  @ApiPropertyOptional({ example: 5, description: 'Null means no upper limit' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  serviceYearsTo?: number;

  @ApiProperty({ example: 1.25 })
  @IsNumber()
  @IsPositive()
  accrualRate: number;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  entitlementDays?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cap?: number;
}
