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

  @ApiPropertyOptional({
    enum: ApprovalWorkflowStatus,
    default: ApprovalWorkflowStatus.ACTIVE,
  })
  @IsEnum(ApprovalWorkflowStatus)
  @IsOptional()
  status?: ApprovalWorkflowStatus;

  @ApiProperty({ type: [CreateWorkflowStepDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}
