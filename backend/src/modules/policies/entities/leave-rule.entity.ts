import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccrualInterval, CutOffType, ResetType } from '../../../common/enums';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';
import { LeavePolicy } from './leave-policy.entity';
import { LeaveType } from '../../leave-types/entities/leave-type.entity';
import { SeniorityMilestone } from './seniority-milestone.entity';

@Entity('leave_rules')
export class LeaveRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LeavePolicy, (p) => p.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: LeavePolicy;

  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ name: 'leave_type_id' })
  leaveTypeId: string;

  @Column({
    name: 'entitlement_days',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  entitlementDays: number | null;

  @Column({ name: 'is_accrued', type: 'boolean', default: false })
  isAccrued: boolean;

  @Column({
    name: 'accrual_rate',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  accrualRate: number | null;

  @Column({
    name: 'accrual_interval',
    type: 'enum',
    enum: AccrualInterval,
    nullable: true,
  })
  accrualInterval: AccrualInterval | null;

  @Column({
    name: 'cut_off_type',
    type: 'enum',
    enum: CutOffType,
    default: CutOffType.HIRE_DATE,
  })
  cutOffType: CutOffType;

  @Column({ name: 'cut_off_month', type: 'int', nullable: true })
  cutOffMonth: number | null;

  @Column({ name: 'cut_off_day', type: 'int', nullable: true })
  cutOffDay: number | null;

  @Column({
    name: 'reset_type',
    type: 'enum',
    enum: ResetType,
    default: ResetType.NONE,
  })
  resetType: ResetType;

  @Column({ name: 'reset_days_count', type: 'int', nullable: true })
  resetDaysCount: number | null;

  @Column({ name: 'carry_over_enabled', type: 'boolean', default: false })
  carryOverEnabled: boolean;

  @Column({
    name: 'max_carry_over',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  maxCarryOver: number | null;

  @Column({
    name: 'carry_over_expiration_enabled',
    type: 'boolean',
    default: false,
  })
  carryOverExpirationEnabled: boolean;

  @Column({ name: 'carry_over_expiration_days', type: 'int', nullable: true })
  carryOverExpirationDays: number | null;

  @Column({ name: 'max_consecutive', type: 'int', default: 0 })
  maxConsecutive: number;

  @Column({ name: 'min_notice_days', type: 'int', default: 0 })
  minNoticeDays: number;

  @Column({
    name: 'max_balance_cap',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  maxBalanceCap: number | null;

  @Column({ name: 'waiting_period_days', type: 'int', default: 0 })
  waitingPeriodDays: number;

  @OneToMany(() => SeniorityMilestone, (m) => m.leaveRule, { cascade: true })
  milestones: SeniorityMilestone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
