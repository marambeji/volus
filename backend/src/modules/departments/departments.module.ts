import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Department]), HrPermissionsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService, TypeOrmModule],
})
export class DepartmentsModule {}
