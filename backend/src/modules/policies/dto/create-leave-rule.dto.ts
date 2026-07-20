import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccrualInterval, CutOffType, ResetType } from '../../../common/enums';
import { CreateMilestoneDto } from './create-milestone.dto';

export class CreateLeaveRuleDto {
  @ApiProperty({ example: 'annual', description: 'LeaveType key or UUID' })
  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  entitlementDays?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isAccrued: boolean;

  // accrualInterval: required and valid MONTHLY|YEARLY when isAccrued=true, else null
  @ApiPropertyOptional({ enum: AccrualInterval })
  @IsEnum(AccrualInterval)
  @ValidateIf((o: CreateLeaveRuleDto) => o.isAccrued === true)
  @IsNotEmpty({ message: 'accrualInterval is required when isAccrued is true' })
  @ValidateIf((o: CreateLeaveRuleDto) => o.isAccrued === false)
  @IsOptional()
  accrualInterval?: AccrualInterval;

  // accrualRate: required positive when isAccrued=true, else null
  @ApiPropertyOptional({ example: 1.25 })
  @IsNumber()
  @IsPositive()
  @ValidateIf((o: CreateLeaveRuleDto) => o.isAccrued === true)
  @IsNotEmpty({
    message:
      'accrualRate is required and must be positive when isAccrued is true',
  })
  @ValidateIf((o: CreateLeaveRuleDto) => o.isAccrued === false)
  @IsOptional()
  accrualRate?: number;

  @ApiProperty({ enum: CutOffType, default: CutOffType.HIRE_DATE })
  @IsEnum(CutOffType)
  cutOffType: CutOffType;

  @ApiPropertyOptional({
    example: 12,
    description: 'Required when cutOffType=FIXED_DATE',
  })
  @IsInt()
  @Min(1)
  @Max(12)
  @ValidateIf((o: CreateLeaveRuleDto) => o.cutOffType === CutOffType.FIXED_DATE)
  @IsNotEmpty()
  @ValidateIf((o: CreateLeaveRuleDto) => o.cutOffType !== CutOffType.FIXED_DATE)
  @IsOptional()
  cutOffMonth?: number;

  @ApiPropertyOptional({
    example: 31,
    description: 'Required when cutOffType=FIXED_DATE',
  })
  @IsInt()
  @Min(1)
  @Max(31)
  @ValidateIf((o: CreateLeaveRuleDto) => o.cutOffType === CutOffType.FIXED_DATE)
  @IsNotEmpty()
  @ValidateIf((o: CreateLeaveRuleDto) => o.cutOffType !== CutOffType.FIXED_DATE)
  @IsOptional()
  cutOffDay?: number;

  @ApiProperty({ enum: ResetType, default: ResetType.NONE })
  @IsEnum(ResetType)
  resetType: ResetType;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  resetDaysCount?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  carryOverEnabled: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(0)
  @ValidateIf((o: CreateLeaveRuleDto) => o.carryOverEnabled === true)
  @IsNotEmpty({
    message: 'maxCarryOver is required when carryOverEnabled is true',
  })
  @ValidateIf((o: CreateLeaveRuleDto) => o.carryOverEnabled === false)
  @IsOptional()
  maxCarryOver?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  carryOverExpirationEnabled?: boolean;

  @ApiPropertyOptional({ example: 90 })
  @IsInt()
  @Min(0)
  @ValidateIf((o: CreateLeaveRuleDto) => o.carryOverExpirationEnabled === true)
  @IsNotEmpty()
  @ValidateIf((o: CreateLeaveRuleDto) => !o.carryOverExpirationEnabled)
  @IsOptional()
  carryOverExpirationDays?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  maxConsecutive?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  minNoticeDays?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxBalanceCap?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  waitingPeriodDays?: number;

  @ApiPropertyOptional({ type: [CreateMilestoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  @IsOptional()
  milestones?: CreateMilestoneDto[];
}
