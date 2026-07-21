import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({ example: 'Lebanon' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'LB' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 3)
  code: string;

  @ApiPropertyOptional({ example: '🇱🇧' })
  @IsString()
  @IsOptional()
  flag?: string;
}
