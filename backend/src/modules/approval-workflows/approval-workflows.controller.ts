import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Approval Workflows')
@Controller({ path: 'approval-workflows', version: '1' })
export class ApprovalWorkflowsController {
  constructor(private readonly service: ApprovalWorkflowsService) {}

  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @ApiOperation({ summary: 'Create a workflow with steps' })
  create(
    @Headers('x-employee-id') actorId: string,
    @Body() dto: CreateApprovalWorkflowDto,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.create(dto, actorId);
  }

  @Get('resolve')
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'Resolve a workflow by country, leave type, and effective date' })
  resolve(
    @Query('countryId', ParseUUIDPipe) countryId: string,
    @Query('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
    @Query('effectiveDate') effectiveDate: string,
  ) {
    return this.service.resolveWorkflow(countryId, leaveTypeId, effectiveDate);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'List workflows with steps' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @ApiOperation({
    summary: 'Update a workflow and replace its steps atomically',
  })
  update(
    @Headers('x-employee-id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalWorkflowDto,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workflow' })
  remove(
    @Headers('x-employee-id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.remove(id, actorId);
  }
}
