import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Import migrations explicitly to avoid glob issues with single quote (') in path on Windows
import { InitialSchema1721498400000 } from './migrations/1721498400000-InitialSchema';
import { AddSpecificApproverEmail1721498500000 } from './migrations/1721498500000-AddSpecificApproverEmail';
import { CreateEmployeesAndBalances1721584800000 } from './migrations/1721584800000-CreateEmployeesAndBalances';
import { AddLeaveConfigurationFields1784660400000 } from './migrations/1784660400000-AddLeaveConfigurationFields';
import { AddHRReviewFields1784677005679 } from './migrations/1784677005679-AddHRReviewFields';
import { WorkflowAndAuditSchema1784680000000 } from './migrations/1784680000000-WorkflowAndAuditSchema';
import { AddDescriptionToAuditLogs1784760000000 } from './migrations/1784760000000-AddDescriptionToAuditLogs';
import { AddUniqueLedgerConstraints1784770000000 } from './migrations/1784770000000-AddUniqueLedgerConstraints';
import { AddSpecificApproverDepartmentAndEmployeeId1784780000000 } from './migrations/1784780000000-AddSpecificApproverDepartmentAndEmployeeId';
import { AddSpecificApproverDepartmentAndEmployeeId1784780000001 } from './migrations/1784780000001-AddSpecificApproverDepartmentAndEmployeeId';
import { CreateLeaveReminders1784790000000 } from './migrations/1784790000000-CreateLeaveReminders';
import { CreateDepartments1784800000000 } from './migrations/1784800000000-CreateDepartments';
import { DropSoftDeleteFromRefData1784810000000 } from './migrations/1784810000000-DropSoftDeleteFromRefData';
import { AddGenderToEmployees1784820000000 } from './migrations/1784820000000-AddGenderToEmployees';
import { CascadePolicyDeletion1784830000000 } from './migrations/1784830000000-CascadePolicyDeletion';
import { RestrictBalanceCascade1784840000000 } from './migrations/1784840000000-RestrictBalanceCascade';
import { MoveApprovalWorkflowToLeaveRules1784850000000 } from './migrations/1784850000000-MoveApprovalWorkflowToLeaveRules';
import { MakeApprovalWorkflowFieldsOptional1784860000000 } from './migrations/1784860000000-MakeApprovalWorkflowFieldsOptional';
import { DropCheckWorkflowStepSpecificPerson1784870000000 } from './migrations/1784870000000-DropCheckWorkflowStepSpecificPerson';
import { AddHrDeleteToLeaveRequests1784880000000 } from './migrations/1784880000000-AddHrDeleteToLeaveRequests';
import { AddHrPermissions1787600000000 } from './migrations/1787600000000-AddHrPermissions';

dotenv.config({ path: path.join(__dirname, '../../.env') });


const url = process.env.DATABASE_URL;
const host = process.env.DB_HOST;
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME;
const ssl = process.env.DB_SSL === 'true';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const sslConfig = ssl ? { ssl: { rejectUnauthorized } } : {};

const baseConfig = url
  ? { url }
  : {
      host,
      port,
      username,
      password,
      database,
    };

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...baseConfig,
  ...sslConfig,
  synchronize: false,
  entities: [path.join(__dirname, '../**/*.entity.{ts,js}')],
  migrations: [
    InitialSchema1721498400000,
    AddSpecificApproverEmail1721498500000,
    CreateEmployeesAndBalances1721584800000,
    AddLeaveConfigurationFields1784660400000,
    AddHRReviewFields1784677005679,
    WorkflowAndAuditSchema1784680000000,
    AddDescriptionToAuditLogs1784760000000,
    AddUniqueLedgerConstraints1784770000000,
    AddSpecificApproverDepartmentAndEmployeeId1784780000000,
    AddSpecificApproverDepartmentAndEmployeeId1784780000001,
    CreateLeaveReminders1784790000000,
    CreateDepartments1784800000000,
    DropSoftDeleteFromRefData1784810000000,
    AddGenderToEmployees1784820000000,
    CascadePolicyDeletion1784830000000,
    RestrictBalanceCascade1784840000000,
    MoveApprovalWorkflowToLeaveRules1784850000000,
    MakeApprovalWorkflowFieldsOptional1784860000000,
    DropCheckWorkflowStepSpecificPerson1784870000000,
    AddHrDeleteToLeaveRequests1784880000000,
    AddHrPermissions1787600000000,
  ],
  logging: true,
});
