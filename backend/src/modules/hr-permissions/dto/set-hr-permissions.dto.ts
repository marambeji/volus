import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, ValidateNested } from 'class-validator';
import { HR_MODULES, HrModule } from '../../../common/constants/hr-modules';

export class HrPermissionEntryDto {
  @IsIn(HR_MODULES)
  module: HrModule;

  @IsBoolean()
  canView: boolean;

  @IsBoolean()
  canManage: boolean;
}

export class SetHrPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrPermissionEntryDto)
  permissions: HrPermissionEntryDto[];
}
