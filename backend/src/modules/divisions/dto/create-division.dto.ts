import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateDivisionDto {
  @ApiProperty({ example: 'Levant' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;
}
