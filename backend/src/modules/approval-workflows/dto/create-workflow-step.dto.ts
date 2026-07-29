import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
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
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  departmentId?: string;

  @ApiPropertyOptional({ example: 'c6a2b8e0-1234-5678-90ab-cdef12345678' })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  specificApproverEmployeeId?: string;

  @ApiPropertyOptional({ example: 'c6a2b8e0-1234-5678-90ab-cdef12345678' })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  specificApproverId?: string;

  @ApiPropertyOptional({ example: 'approver@example.com' })
  @IsEmail()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  specificApproverEmail?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}
