import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { EmployeeRole, EmployeeStatus } from '../../../common/enums';

const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'fullName',
  'email',
  'hireDate',
  'status',
  'department',
  'jobTitle',
];

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  countryId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  divisionId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @ApiPropertyOptional({ enum: EmployeeRole })
  @IsEnum(EmployeeRole)
  @IsOptional()
  role?: EmployeeRole;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  policyId?: string;

  @ApiPropertyOptional({ enum: ALLOWED_SORT_FIELDS })
  @IsString()
  @IsIn(ALLOWED_SORT_FIELDS)
  @IsOptional()
  sortBy?: string = 'createdAt';
}
