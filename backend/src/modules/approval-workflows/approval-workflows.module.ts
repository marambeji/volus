import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalWorkflowsController } from './approval-workflows.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalWorkflow, ApprovalWorkflowStep])],
  controllers: [ApprovalWorkflowsController],
  providers: [ApprovalWorkflowsService],
  exports: [ApprovalWorkflowsService, TypeOrmModule],
})
export class ApprovalWorkflowsModule {}
