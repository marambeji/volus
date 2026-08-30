import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateReminderSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  delayHours?: number;
}
