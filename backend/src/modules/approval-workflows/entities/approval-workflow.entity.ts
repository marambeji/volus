import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalWorkflowStatus } from '../../../common/enums';
import { ApprovalWorkflowStep } from './approval-workflow-step.entity';

@Entity('approval_workflows')
export class ApprovalWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150, unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: ApprovalWorkflowStatus,
    default: ApprovalWorkflowStatus.ACTIVE,
  })
  status: ApprovalWorkflowStatus;

  @OneToMany(() => ApprovalWorkflowStep, (step) => step.workflow, {
    cascade: true,
    eager: false,
  })
  steps: ApprovalWorkflowStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
