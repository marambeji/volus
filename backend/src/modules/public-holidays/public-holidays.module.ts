import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicHoliday } from './entities/public-holiday.entity';
import { PublicHolidaysService } from './public-holidays.service';
import { PublicHolidaysController } from './public-holidays.controller';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([PublicHoliday]), HrPermissionsModule],
  controllers: [PublicHolidaysController],
  providers: [PublicHolidaysService],
  exports: [PublicHolidaysService],
})
export class PublicHolidaysModule {}
