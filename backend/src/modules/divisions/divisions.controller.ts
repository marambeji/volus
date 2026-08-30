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
import { DivisionsService } from './divisions.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Divisions')
@Controller({ path: 'divisions', version: '1' })
export class DivisionsController {
  constructor(private readonly service: DivisionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a division' })
  create(@Body() dto: CreateDivisionDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List divisions' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a division by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a division' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDivisionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a division' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
