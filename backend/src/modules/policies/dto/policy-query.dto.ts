import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { LeavePolicyStatus } from '../../../common/enums';

export class PolicyQueryDto extends PaginationQueryDto {
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
  leaveTypeId?: string;

  @ApiPropertyOptional({ enum: LeavePolicyStatus })
  @IsEnum(LeavePolicyStatus)
  @IsOptional()
  status?: LeavePolicyStatus;
}
