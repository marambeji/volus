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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Leave Policies')
@Controller({ path: 'policies', version: '1' })
export class PoliciesController {
  constructor(private readonly service: PoliciesService) {}

  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @ApiOperation({
    summary: 'Create a leave policy with rules and milestones (atomic)',
  })
  create(@Body() dto: CreatePolicyDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('leavePolicies', 'view')
  @ApiOperation({
    summary: 'List policies with pagination, search, and filters',
  })
  findAll(@Query() query: PolicyQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('leavePolicies', 'view')
  @ApiOperation({
    summary: 'Get full policy detail (frontend-compatible shape)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @ApiOperation({
    summary: 'Update policy atomically (replaces rules/milestones)',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePolicyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a policy' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
