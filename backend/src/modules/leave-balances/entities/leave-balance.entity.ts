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
import { Employee } from '../../employees/entities/employee.entity';
import { LeaveType } from '../../leave-types/entities/leave-type.entity';
import { LeaveRule } from '../../policies/entities/leave-rule.entity';
import { LeaveLedgerEntry } from './leave-ledger-entry.entity';

@Entity('leave_balances')
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType?: LeaveType;

  @Column({ name: 'leave_policy_rule_id', type: 'uuid', nullable: true })
  leavePolicyRuleId?: string | null;

  @ManyToOne(() => LeaveRule, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'leave_policy_rule_id' })
  leavePolicyRule?: LeaveRule | null;

  @Column({ type: 'integer' })
  year: number;

  @Column({
    name: 'available_balance',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  availableBalance: number;

  @Column({
    name: 'used_ytd',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  usedYtd: number;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pending: number;

  @Column({
    name: 'carried_over',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  carriedOver: number;

  @OneToMany(() => LeaveLedgerEntry, (lle) => lle.balance)
  ledgerEntries?: LeaveLedgerEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
