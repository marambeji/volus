import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';
import { LeaveRule } from './leave-rule.entity';

@Entity('seniority_milestones')
export class SeniorityMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LeaveRule, (r) => r.milestones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_rule_id' })
  leaveRule: LeaveRule;

  @Column({ name: 'leave_rule_id' })
  leaveRuleId: string;

  @Column({
    name: 'service_years_from',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  serviceYearsFrom: number;

  @Column({
    name: 'service_years_to',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  serviceYearsTo: number | null;

  @Column({
    name: 'accrual_rate',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  accrualRate: number;

  @Column({
    name: 'entitlement_days',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  entitlementDays: number | null;

  @Column({
    name: 'cap',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cap: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
