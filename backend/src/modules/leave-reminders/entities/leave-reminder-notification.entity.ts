import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalInstance } from '../../leave-requests/entities/approval-instance.entity';
import { LeaveRequest } from '../../leave-requests/entities/leave-request.entity';
import { Employee } from '../../employees/entities/employee.entity';

/** Records a sent pending-approval email reminder. One row per (approvalInstance, approver) — enforced by a unique index — so a step is never reminded twice for the same approver. */
@Entity('leave_reminder_notifications')
export class LeaveReminderNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'approval_instance_id', type: 'uuid' })
  approvalInstanceId: string;

  @ManyToOne(() => ApprovalInstance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_instance_id' })
  approvalInstance?: ApprovalInstance;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @ManyToOne(() => LeaveRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request?: LeaveRequest;

  @Column({ name: 'approver_id', type: 'uuid' })
  approverId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approver_id' })
  approver?: Employee;

  @Column({ name: 'approver_email', type: 'varchar', length: 255 })
  approverEmail: string;

  @Column({ name: 'sent_at', type: 'timestamp' })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
