import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrPermissionsService } from './hr-permissions.service';
import { SetHrPermissionsDto } from './dto/set-hr-permissions.dto';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@ApiTags('HR Permissions')
@Controller({ path: 'hr-permissions', version: '1' })
@UseGuards(SuperAdminGuard)
export class HrPermissionsController {
  constructor(private readonly service: HrPermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List HR Admin users with effective permissions (Super Admin only)' })
  listHrAdmins() {
    return this.service.listHrAdmins();
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Get effective permissions for one HR Admin user (Super Admin only)' })
  getPermissions(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.getEffectivePermissions(employeeId);
  }

  @Put(':employeeId')
  @ApiOperation({ summary: 'Replace permissions for one HR Admin user (Super Admin only)' })
  setPermissions(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SetHrPermissionsDto,
  ) {
    return this.service.setPermissions(employeeId, dto.permissions);
  }
}
