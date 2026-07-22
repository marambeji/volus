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
import { PublicHolidaysService } from './public-holidays.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';

@ApiTags('Public Holidays')
@Controller({ path: 'holidays', version: '1' })
export class PublicHolidaysController {
  constructor(private readonly service: PublicHolidaysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a public holiday' })
  create(@Body() dto: CreatePublicHolidayDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List holidays; pass year to project recurring holidays',
  })
  findAll(@Query() query: HolidayQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a holiday by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a holiday' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicHolidayDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a public holiday' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
