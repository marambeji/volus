import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNotIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdjustBalanceDto {
  @ApiProperty({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 5.5, description: 'Signed amount, non-zero' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotIn([0], { message: 'Adjustment amount cannot be zero.' })
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'Annual bonus adjustment' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ example: 'idemp-123456' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  idempotencyKey?: string;
}
