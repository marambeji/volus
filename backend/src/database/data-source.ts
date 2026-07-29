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
import { AddSpecificApproverDepartmentAndEmployeeId1784780000001 } from './migrations/1784780000001-AddSpecificApproverDepartmentAndEmployeeId';

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
    AddSpecificApproverDepartmentAndEmployeeId1784780000001,
  ],
  logging: true,
});
