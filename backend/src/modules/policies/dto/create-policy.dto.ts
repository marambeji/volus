import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeavePolicyStatus } from '../../../common/enums';
import { CreateLeaveRuleDto } from './create-leave-rule.dto';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Lebanon Annual Leave Policy' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  policyName: string;

  @ApiProperty({ example: 'LB', description: 'Country ISO code' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiPropertyOptional({
    example: [5, 6],
    description: '0=Sun...6=Sat, unique values 0-6',
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  @IsOptional()
  weekendDays?: number[];

  @ApiProperty({ example: 8 })
  @IsNumber()
  @IsPositive()
  workingHoursPerDay: number;

  @ApiPropertyOptional({
    example: 'Levant, Europe',
    description: 'Comma-separated division names',
  })
  @IsString()
  @IsOptional()
  divisionAssignment?: string;

  @ApiPropertyOptional({
    enum: LeavePolicyStatus,
    default: LeavePolicyStatus.DRAFT,
  })
  @IsEnum(LeavePolicyStatus)
  @IsOptional()
  status?: LeavePolicyStatus;

  @ApiPropertyOptional({ type: [CreateLeaveRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLeaveRuleDto)
  @IsOptional()
  leaveQuotas?: CreateLeaveRuleDto[];
}
