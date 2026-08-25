import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicHoliday } from './entities/public-holiday.entity';
import { PublicHolidaysService } from './public-holidays.service';
import { PublicHolidaysController } from './public-holidays.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PublicHoliday])],
  controllers: [PublicHolidaysController],
  providers: [PublicHolidaysService],
  exports: [PublicHolidaysService],
})
export class PublicHolidaysModule {}
