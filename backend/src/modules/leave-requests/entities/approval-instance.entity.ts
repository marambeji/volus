import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeaveRequest } from './leave-request.entity';
import { ApprovalWorkflow } from '../../approval-workflows/entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from '../../approval-workflows/entities/approval-workflow-step.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { ApprovalInstanceStatus, ApproverType } from '../../../common/enums';

@Entity('approval_instances')
export class ApprovalInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @ManyToOne(() => LeaveRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request?: LeaveRequest;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId: string;

  @ManyToOne(() => ApprovalWorkflow, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_id' })
  workflow?: ApprovalWorkflow;

  @Column({ name: 'step_id', type: 'uuid' })
  stepId: string;

  @ManyToOne(() => ApprovalWorkflowStep, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'step_id' })
  step?: ApprovalWorkflowStep;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({
    name: 'approver_type',
    type: 'enum',
    enum: ApproverType,
  })
  approverType: ApproverType;

  @Column({ name: 'resolved_approver_id', type: 'uuid', nullable: true })
  resolvedApproverId?: string | null;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'resolved_approver_id' })
  resolvedApprover?: Employee | null;

  @Column({
    type: 'enum',
    enum: ApprovalInstanceStatus,
    default: ApprovalInstanceStatus.WAITING,
  })
  status: ApprovalInstanceStatus;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote?: string | null;

  @Column({ name: 'action_date', type: 'timestamp', nullable: true })
  actionDate?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
