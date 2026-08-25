import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HrPermissionsController } from './hr-permissions.controller';
import { HrPermissionsService } from './hr-permissions.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

describe('HrPermissionsController', () => {
  let controller: HrPermissionsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      listHrAdmins: jest.fn(),
      getEffectivePermissions: jest.fn(),
      setPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HrPermissionsController],
      providers: [
        { provide: HrPermissionsService, useValue: service },
        { provide: DataSource, useValue: {} },
        SuperAdminGuard,
      ],
    }).compile();

    controller = module.get(HrPermissionsController);
  });

  it('lists HR admins', async () => {
    service.listHrAdmins.mockResolvedValue([{ id: 'e1' }]);
    expect(await controller.listHrAdmins()).toEqual([{ id: 'e1' }]);
  });

  it('gets one employee permissions', async () => {
    service.getEffectivePermissions.mockResolvedValue({});
    await controller.getPermissions('e1');
    expect(service.getEffectivePermissions).toHaveBeenCalledWith('e1');
  });

  it('sets permissions', async () => {
    const dto = { permissions: [{ module: 'employees' as const, canView: true, canManage: false }] };
    service.setPermissions.mockResolvedValue({});
    await controller.setPermissions('e1', dto);
    expect(service.setPermissions).toHaveBeenCalledWith('e1', dto.permissions);
  });
});
