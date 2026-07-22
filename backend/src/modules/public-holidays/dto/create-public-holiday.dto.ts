import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreatePublicHolidayDto {
  @ApiProperty({ example: 'Christmas Day' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @ApiProperty({
    example: '2026-12-25',
    description: 'ISO date string YYYY-MM-DD',
  })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid-of-country' })
  @IsUUID()
  countryId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'If true, applies every year on the same month/day',
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}
