import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AuditActionType } from '../../common/enums';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async log(
    actorId: string | null,
    actionType: AuditActionType,
    entityType: string,
    entityId: string,
    details: {
      oldValues?: any;
      newValues?: any;
      reason?: string;
      correlationId?: string;
    },
    em?: EntityManager,
  ): Promise<AuditLog> {
    let actorName = 'System';
    let actorRole = 'SYSTEM';

    if (actorId) {
      const repo = em ? em.getRepository(Employee) : this.employeeRepo;
      const employee = await repo.findOne({ where: { id: actorId } });
      if (employee) {
        actorName = employee.fullName;
        actorRole = employee.role;
      }
    }

    const { oldValues, newValues, reason, correlationId } = details;

    // Detect changed fields if both old and new values are present
    let changedFields: string[] | null = null;
    if (oldValues && newValues) {
      changedFields = [];
      const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
      for (const key of allKeys) {
        if (
          key !== 'createdAt' &&
          key !== 'updatedAt' &&
          JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
        ) {
          changedFields.push(key);
        }
      }
    }

    const manager = em ?? this.auditLogRepo.manager;
    const auditLog = manager.create(AuditLog, {
      actorId,
      actorName,
      actorRole,
      actionType,
      entityType,
      entityId,
      oldValues: oldValues ? this.sanitize(oldValues) : null,
      newValues: newValues ? this.sanitize(newValues) : null,
      changedFields,
      reason,
      correlationId,
    });

    return manager.save(AuditLog, auditLog);
  }

  // Fetch audit history for a specific record
  async getHistory(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  // Global log retrieval (for HR/admin views)
  async findAll(query: { entityType?: string; actionType?: AuditActionType }): Promise<AuditLog[]> {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.actionType) where.actionType = query.actionType;
    return this.auditLogRepo.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  // Employee-specific notification logs retrieval
  async findMyNotifications(employeeId: string): Promise<AuditLog[]> {
    return this.auditLogRepo
      .createQueryBuilder('al')
      .where('al.actorId = :employeeId', { employeeId })
      .orWhere("al.newValues->>'employeeId' = :employeeId", { employeeId })
      .orWhere("al.oldValues->>'employeeId' = :employeeId", { employeeId })
      .orWhere("al.entityType = 'Employee' AND al.entityId = :employeeId", { employeeId })
      .orderBy('al.timestamp', 'DESC')
      .take(30)
      .getMany();
  }

  // Sanitizer to prevent leaking passwords, secrets, or document content
  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = { ...obj };
    const sensitiveKeys = ['password', 'token', 'secret', 'document', 'avatar'];
    for (const key of Object.keys(clean)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        clean[key] = '[REDACTED]';
      } else if (typeof clean[key] === 'object') {
        clean[key] = this.sanitize(clean[key]);
      }
    }
    return clean;
  }
}
