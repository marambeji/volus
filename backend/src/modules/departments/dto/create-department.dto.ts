import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsHexColor()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  headEmployeeId?: string;
}
