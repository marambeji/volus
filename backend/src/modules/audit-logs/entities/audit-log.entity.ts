import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { AuditActionType } from '../../../common/enums';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: Employee | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 255 })
  actorName: string;

  @Column({ name: 'actor_role', type: 'varchar', length: 100 })
  actorRole: string;

  @Column({
    name: 'action_type',
    type: 'varchar',
    length: 100,
  })
  actionType: AuditActionType;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId: string;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: any | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: any | null;

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields?: any | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId?: string | null;

  /** Human-readable description generated at log time */
  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
