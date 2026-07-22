import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApproverType } from '../../../common/enums';

export class CreateWorkflowStepDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  stepOrder: number;

  @ApiProperty({ enum: ApproverType })
  @IsEnum(ApproverType)
  approverType: ApproverType;

  @ApiPropertyOptional({ example: 'c6a2b8e0-1234-5678-90ab-cdef12345678' })
  @IsUUID()
  @IsOptional()
  specificApproverId?: string;

  @ApiPropertyOptional({ example: 'approver@example.com' })
  @IsEmail()
  @IsOptional()
  specificApproverEmail?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}
