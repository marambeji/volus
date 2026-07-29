import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApproverType } from '../../../common/enums';
import { ApprovalWorkflow } from './approval-workflow.entity';

@Entity('approval_workflow_steps')
export class ApprovalWorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ApprovalWorkflow, (wf) => wf.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: ApprovalWorkflow;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'approver_type', type: 'enum', enum: ApproverType })
  approverType: ApproverType;

  @Column({ name: 'department_id', type: 'varchar', length: 255, nullable: true })
  departmentId: string | null;

  @Column({ name: 'specific_approver_employee_id', type: 'uuid', nullable: true })
  specificApproverEmployeeId: string | null;

  @Column({ name: 'specific_approver_id', type: 'uuid', nullable: true })
  specificApproverId: string | null;

  @Column({
    name: 'specific_approver_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  specificApproverEmail: string | null;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
