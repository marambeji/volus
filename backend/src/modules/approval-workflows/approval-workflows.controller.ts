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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Approval Workflows')
@Controller({ path: 'approval-workflows', version: '1' })
export class ApprovalWorkflowsController {
  constructor(private readonly service: ApprovalWorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow with steps' })
  create(@Body() dto: CreateApprovalWorkflowDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows with steps' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a workflow and replace its steps atomically',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalWorkflowDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workflow' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
