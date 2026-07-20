import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
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

  @ApiPropertyOptional({ example: 'uuid-of-employee' })
  @IsUUID()
  @IsOptional()
  @ValidateIf(
    (o: CreateWorkflowStepDto) =>
      o.approverType === ApproverType.SPECIFIC_PERSON,
  )
  @IsNotEmpty({
    message: 'specificApproverId is required for SPECIFIC_PERSON approver type',
  })
  specificApproverId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}
