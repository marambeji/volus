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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Departments')
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('departments', 'view')
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('departments', 'view')
  @ApiOperation({ summary: 'Get a department by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @ApiOperation({ summary: 'Update a department' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a department' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
