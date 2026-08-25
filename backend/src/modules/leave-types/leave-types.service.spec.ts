import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { LeaveType } from './entities/leave-type.entity';

describe('LeaveTypesService', () => {
  let service: LeaveTypesService;
  let repoMock: any;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'lt-1', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'lt-1', ...entity })),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveTypesService,
        {
          provide: getRepositoryToken(LeaveType),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<LeaveTypesService>(LeaveTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new leave type if key does not exist', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const dto = { key: 'ANNUAL', label: 'Annual Leave', defaultDays: 25 } as any;

      const result = await service.create(dto);

      expect(repoMock.findOne).toHaveBeenCalledWith({ where: { key: 'ANNUAL' } });
      expect(repoMock.create).toHaveBeenCalledWith(dto);
      expect(repoMock.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'lt-1');
    });

    it('should throw ConflictException if key already exists', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'lt-existing', key: 'ANNUAL' });
      const dto = { key: 'ANNUAL', label: 'Annual Leave' } as any;

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated leave types with default parameters', async () => {
      const mockList = [{ id: 'lt-1', key: 'ANNUAL', label: 'Annual' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockList, 1]);

      const result = await service.findAll({});

      expect(repoMock.createQueryBuilder).toHaveBeenCalledWith('lt');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'lt.key NOT ILIKE :e2ePrefix AND lt.label NOT ILIKE :e2ePrefix',
        { e2ePrefix: 'e2e_%' }
      );
      expect(result.data).toEqual(mockList);
      expect(result.meta.total).toBe(1);
    });

    it('should apply search filter q when provided', async () => {
      await service.findAll({ q: 'sick', page: 2, limit: 10, sortBy: 'label', sortOrder: 'DESC' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(lt.label ILIKE :q OR lt.key ILIKE :q)',
        { q: '%sick%' }
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('lt.label', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('should return leave type if found', async () => {
      const item = { id: 'lt-1', key: 'ANNUAL' };
      repoMock.findOne.mockResolvedValue(item);

      const res = await service.findOne('lt-1');
      expect(res).toEqual(item);
    });

    it('should throw NotFoundException if leave type not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('lt-99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByKey', () => {
    it('should return leave type or null', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'lt-1', key: 'ANNUAL' });
      const res = await service.findByKey('ANNUAL');
      expect(res).toEqual({ id: 'lt-1', key: 'ANNUAL' });
    });
  });

  describe('update', () => {
    it('should update leave type if valid', async () => {
      const existing = { id: 'lt-1', key: 'ANNUAL', label: 'Old' };
      repoMock.findOne.mockResolvedValueOnce(existing);

      const result = await service.update('lt-1', { label: 'Updated' });

      expect(repoMock.save).toHaveBeenCalled();
      expect(result.label).toBe('Updated');
    });

    it('should throw ConflictException when changing key to an already existing key', async () => {
      const existing = { id: 'lt-1', key: 'ANNUAL' };
      repoMock.findOne.mockResolvedValueOnce(existing); // findOne inside update
      repoMock.findOne.mockResolvedValueOnce({ id: 'lt-2', key: 'SICK' }); // check key conflict

      await expect(service.update('lt-1', { key: 'SICK' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should hard remove existing leave type', async () => {
      const existing = { id: 'lt-1', key: 'ANNUAL' };
      repoMock.findOne.mockResolvedValue(existing);

      await service.remove('lt-1');

      expect(repoMock.remove).toHaveBeenCalledWith(existing);
    });
  });
});
