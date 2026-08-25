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
import { Country } from '../../countries/entities/country.entity';
import { Division } from '../../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../../approval-workflows/entities/approval-workflow.entity';
import {
  EmployeeRole,
  EmployeeStatus,
  EmploymentType,
  Gender,
  WorkMode,
} from '../../../common/enums';
import { EmployeePolicyAssignment } from './employee-policy-assignment.entity';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_number', type: 'varchar', length: 50, nullable: true })
  employeeNumber?: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 150 })
  jobTitle: string;

  @Column({ type: 'varchar', length: 150 })
  department: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  unit?: string | null;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string | null;

  @ManyToOne(() => Employee, (emp) => emp.directReports, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'manager_id' })
  manager?: Employee | null;

  @OneToMany(() => Employee, (emp) => emp.manager)
  directReports?: Employee[];

  @Column({ name: 'country_id', type: 'uuid', nullable: true })
  countryId?: string | null;

  @ManyToOne(() => Country, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'country_id' })
  country?: Country | null;

  @Column({ name: 'division_id', type: 'uuid', nullable: true })
  divisionId?: string | null;

  @ManyToOne(() => Division, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'division_id' })
  division?: Division | null;

  @Column({ name: 'approval_workflow_id', type: 'uuid', nullable: true })
  approvalWorkflowId?: string | null;

  @ManyToOne(() => ApprovalWorkflow, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approval_workflow_id' })
  approvalWorkflow?: ApprovalWorkflow | null;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({
    name: 'work_mode',
    type: 'enum',
    enum: WorkMode,
    default: WorkMode.ONSITE,
  })
  workMode: WorkMode;

  @Column({
    type: 'enum',
    enum: EmployeeRole,
    default: EmployeeRole.EMPLOYEE,
  })
  role: EmployeeRole;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender | null;

  @Column({
    name: 'emergency_contacts',
    type: 'jsonb',
    default: '[]',
  })
  emergencyContacts: EmergencyContact[];

  @OneToMany(() => EmployeePolicyAssignment, (epa) => epa.employee)
  policyAssignments?: EmployeePolicyAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date | null;
}
