import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';
import { EmployeeStatus } from '../../../common/enums';

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['policyId'] as const),
) {
  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  // Overrides the inherited `policyId?: string` so callers can pass `null`
  // to explicitly unassign the employee's leave policy (omitting the field
  // leaves the current assignment untouched).
  @ApiPropertyOptional({
    example: 'b84d4562-0a24-425c-b82d-94aae15b0a96',
    nullable: true,
    description: "Pass null to remove the employee's leave policy assignment.",
  })
  @IsUUID()
  @IsOptional()
  policyId?: string | null;
}
