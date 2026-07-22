import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Employee])],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService, TypeOrmModule],
})
export class AuditLogsModule {}
