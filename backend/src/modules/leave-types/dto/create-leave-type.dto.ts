import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { LeaveTrackingMode } from '../../../common/enums';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'annual' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  key: string;

  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  label: string;

  @ApiProperty({ enum: LeaveTrackingMode })
  @IsEnum(LeaveTrackingMode)
  trackingMode: LeaveTrackingMode;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
