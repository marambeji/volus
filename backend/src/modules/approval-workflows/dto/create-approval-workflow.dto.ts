import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalWorkflowStatus } from '../../../common/enums';
import { CreateWorkflowStepDto } from './create-workflow-step.dto';

export class CreateApprovalWorkflowDto {
  @ApiProperty({ example: 'Standard Manager Approval' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: 'Approval workflow description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ApprovalWorkflowStatus,
    default: ApprovalWorkflowStatus.ACTIVE,
  })
  @IsEnum(ApprovalWorkflowStatus)
  @IsOptional()
  status?: ApprovalWorkflowStatus;

  @ApiProperty({ example: 'c6a2b8e0-1234-5678-90ab-cdef12345678' })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ example: 'c6a2b8e0-1234-5678-90ab-cdef12345678' })
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-07-22' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @ApiProperty({ type: [CreateWorkflowStepDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}

