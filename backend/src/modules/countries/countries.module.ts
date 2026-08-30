import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Country]), HrPermissionsModule],
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService, TypeOrmModule],
})
export class CountriesModule {}
