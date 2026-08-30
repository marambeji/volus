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
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Countries')
@Controller({ path: 'countries', version: '1' })
export class CountriesController {
  constructor(private readonly service: CountriesService) {}

  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @ApiOperation({ summary: 'Create a country' })
  create(@Body() dto: CreateCountryDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('countries', 'view')
  @ApiOperation({ summary: 'List countries with pagination and search' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('countries', 'view')
  @ApiOperation({ summary: 'Get a country by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @ApiOperation({ summary: 'Update a country' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCountryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a country' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
