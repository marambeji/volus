import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { LeavePolicy } from '../../policies/entities/leave-policy.entity';

@Entity('employee_policy_assignments')
export class EmployeePolicyAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, (emp) => emp.policyAssignments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'leave_policy_id', type: 'uuid' })
  leavePolicyId: string;

  @ManyToOne(() => LeavePolicy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_policy_id' })
  leavePolicy?: LeavePolicy;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
