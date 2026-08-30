import { SetMetadata } from '@nestjs/common';
import { HrModule } from '../constants/hr-modules';

export const REQUIRE_MODULE_KEY = 'requireModule';

export type PermissionLevel = 'view' | 'manage';

export interface RequireModuleMeta {
  module: HrModule;
  level: PermissionLevel;
}

export const RequireModule = (module: HrModule, level: PermissionLevel) =>
  SetMetadata(REQUIRE_MODULE_KEY, { module, level });
