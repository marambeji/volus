import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Division } from './entities/division.entity';
import { DivisionsService } from './divisions.service';
import { DivisionsController } from './divisions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Division])],
  controllers: [DivisionsController],
  providers: [DivisionsService],
  exports: [DivisionsService, TypeOrmModule],
})
export class DivisionsModule {}
