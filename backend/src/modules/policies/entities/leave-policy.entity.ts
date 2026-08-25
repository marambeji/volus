import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeavePolicyStatus } from '../../../common/enums';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Country } from '../../countries/entities/country.entity';
import { Division } from '../../divisions/entities/division.entity';
import { LeaveRule } from './leave-rule.entity';

@Entity('leave_policies')
export class LeavePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_name', length: 255 })
  policyName: string;

  @ManyToOne(() => Country, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ name: 'country_id' })
  countryId: string;

  @Column({
    name: 'working_hours_per_day',
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  workingHoursPerDay: number;

  // Store weekend days as integer array — 0=Sun, 6=Sat
  @Column({ name: 'weekend_days', type: 'int', array: true, default: [] })
  weekendDays: number[];

  @Column({
    type: 'enum',
    enum: LeavePolicyStatus,
    default: LeavePolicyStatus.DRAFT,
  })
  status: LeavePolicyStatus;

  @ManyToMany(() => Division, { eager: true })
  @JoinTable({
    name: 'leave_policy_divisions',
    joinColumn: { name: 'leave_policy_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'division_id', referencedColumnName: 'id' },
  })
  divisions: Division[];

  @OneToMany(() => LeaveRule, (r) => r.policy, { cascade: true })
  rules: LeaveRule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
