import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
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

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    type: 'enum',
    enum: ApprovalWorkflowStatus,
    default: ApprovalWorkflowStatus.ACTIVE,
  })
  status: ApprovalWorkflowStatus;

  @Column({ name: 'country_id', type: 'uuid' })
  countryId: string;

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy?: string | null;

  @Column({ name: 'last_modified_by', type: 'varchar', length: 255, nullable: true })
  lastModifiedBy?: string | null;

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
