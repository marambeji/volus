import { Test, TestingModule } from '@nestjs/testing';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';

describe('LeaveTypesController', () => {
  let controller: LeaveTypesController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveTypesController],
      providers: [
        {
          provide: LeaveTypesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<LeaveTypesController>(LeaveTypesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate create to service', async () => {
    const dto = { key: 'ANNUAL', label: 'Annual' } as any;
    serviceMock.create.mockResolvedValue({ id: '1', ...dto });
    const res = await controller.create(dto);
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: '1', ...dto });
  });

  it('should delegate findAll to service', async () => {
    const query = { page: 1, limit: 10 };
    serviceMock.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll(query);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
  });

  it('should delegate findOne to service', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'lt-1' });
    const res = await controller.findOne('lt-1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('lt-1');
    expect(res).toEqual({ id: 'lt-1' });
  });

  it('should delegate update to service', async () => {
    const dto = { label: 'Updated' } as any;
    serviceMock.update.mockResolvedValue({ id: 'lt-1', ...dto });
    const res = await controller.update('lt-1', dto);
    expect(serviceMock.update).toHaveBeenCalledWith('lt-1', dto);
    expect(res).toEqual({ id: 'lt-1', ...dto });
  });

  it('should delegate remove to service', async () => {
    serviceMock.remove.mockResolvedValue(undefined);
    await controller.remove('lt-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('lt-1');
  });
});
