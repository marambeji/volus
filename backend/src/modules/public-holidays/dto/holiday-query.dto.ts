import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HolidayQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  countryId?: string;

  @ApiPropertyOptional({
    example: 2027,
    description: 'Year to filter/project holidays into',
  })
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  @IsOptional()
  year?: number;
}
