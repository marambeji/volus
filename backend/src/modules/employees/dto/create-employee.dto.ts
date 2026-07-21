import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EmployeeRole, EmploymentType, WorkMode } from '../../../common/enums';
import { EmergencyContactDto } from './emergency-contact.dto';

export class CreateEmployeeDto {
  @ApiPropertyOptional({ example: 'EMP-001' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeNumber?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'john.doe@novelus.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+961 70 123456' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  avatar?: string;

  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  jobTitle: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  department: string;

  @ApiPropertyOptional({ example: 'Backend' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  unit?: string;

  @ApiPropertyOptional({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsOptional()
  managerId?: string;

  @ApiProperty({ example: 'LB' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiPropertyOptional({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsOptional()
  divisionId?: string;

  @ApiPropertyOptional({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsOptional()
  approvalWorkflowId?: string;

  @ApiPropertyOptional({ example: 'b84d4562-0a24-425c-b82d-94aae15b0a96' })
  @IsUUID()
  @IsOptional()
  policyId?: string;

  @ApiPropertyOptional({
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: WorkMode, default: WorkMode.ONSITE })
  @IsEnum(WorkMode)
  @IsOptional()
  workMode?: WorkMode;

  @ApiPropertyOptional({ enum: EmployeeRole, default: EmployeeRole.EMPLOYEE })
  @IsEnum(EmployeeRole)
  @IsOptional()
  role?: EmployeeRole;

  @ApiProperty({ example: '2024-01-15' })
  @IsISO8601()
  @IsNotEmpty()
  hireDate: string;

  @ApiPropertyOptional({ type: [EmergencyContactDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContacts?: EmergencyContactDto[];
}
