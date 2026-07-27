import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { LeaveType } from '../../leave-types/entities/leave-type.entity';
import { LedgerTransactionType } from '../../../common/enums';

@Entity('leave_ledger_entries')
export class LeaveLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'balance_id', type: 'uuid' })
  balanceId: string;

  @ManyToOne(() => LeaveBalance, (lb) => lb.ledgerEntries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'balance_id' })
  balance?: LeaveBalance;

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

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: LedgerTransactionType,
  })
  transactionType: LedgerTransactionType;

  @CreateDateColumn({ name: 'transaction_date' })
  transactionDate: Date;

  @Column({
    name: 'signed_amount',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  signedAmount: number;

  @Column({
    name: 'resulting_balance',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  resultingBalance: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceType?: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId?: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  idempotencyKey?: string | null;

  @Column({
    name: 'request_fingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  requestFingerprint?: string | null;

  @Column({ name: 'performed_by_employee_id', type: 'uuid', nullable: true })
  performedByEmployeeId?: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'performed_by_employee_id' })
  performedByEmployee?: Employee | null;

  @CreateDateColumn()
  createdAt: Date;
}
