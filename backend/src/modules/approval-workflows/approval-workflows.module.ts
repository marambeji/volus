import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalWorkflowsController } from './approval-workflows.controller';
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalWorkflow, ApprovalWorkflowStep]), HrPermissionsModule],
  controllers: [ApprovalWorkflowsController],
  providers: [ApprovalWorkflowsService],
  exports: [ApprovalWorkflowsService, TypeOrmModule],
})
export class ApprovalWorkflowsModule {}
