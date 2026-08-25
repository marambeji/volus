import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import { HrPermissionsService } from './hr-permissions.service';
import { HrPermissionsController } from './hr-permissions.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([HrPermission, Employee])],
  controllers: [HrPermissionsController],
  providers: [HrPermissionsService, PermissionGuard],
  exports: [HrPermissionsService, PermissionGuard],
})
export class HrPermissionsModule {}
