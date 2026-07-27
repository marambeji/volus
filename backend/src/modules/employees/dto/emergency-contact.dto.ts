import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EmergencyContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  relationship: string;

  @ApiProperty({ example: '+961 3 123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;
}
