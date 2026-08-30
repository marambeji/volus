import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DivisionsService } from './divisions.service';
import { Division } from './entities/division.entity';

describe('DivisionsService', () => {
  let service: DivisionsService;
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
      create: jest.fn((dto) => ({ id: 'div-1', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'div-1', ...entity })),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DivisionsService,
        {
          provide: getRepositoryToken(Division),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<DivisionsService>(DivisionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new division', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const dto = { name: 'Engineering' } as any;

      const result = await service.create(dto);

      expect(repoMock.findOne).toHaveBeenCalledWith({ where: { name: 'Engineering' } });
      expect(result).toHaveProperty('id', 'div-1');
    });

    it('should throw ConflictException if division name already exists', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'div-existing', name: 'Engineering' });
      await expect(service.create({ name: 'Engineering' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of divisions', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'div-1', name: 'Engineering' }], 1]);

      const res = await service.findAll({ q: 'Eng', page: 1, limit: 10 });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('division.name ILIKE :q', { q: '%Eng%' });
      expect(res.data).toHaveLength(1);
    });
  });

  describe('findOne & findByName', () => {
    it('should return division when found by id', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'div-1', name: 'Engineering' });
      const res = await service.findOne('div-1');
      expect(res.name).toBe('Engineering');
    });

    it('should throw NotFoundException when id not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('div-99')).rejects.toThrow(NotFoundException);
    });

    it('should find division by name', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'div-1', name: 'Engineering' });
      const res = await service.findByName('Engineering');
      expect(res?.id).toBe('div-1');
    });
  });

  describe('update', () => {
    it('should update division name successfully', async () => {
      repoMock.findOne.mockResolvedValueOnce({ id: 'div-1', name: 'Engineering' });
      const res = await service.update('div-1', { name: 'Product Engineering' });
      expect(res.name).toBe('Product Engineering');
    });

    it('should throw ConflictException if new name belongs to existing division', async () => {
      repoMock.findOne.mockResolvedValueOnce({ id: 'div-1', name: 'Engineering' });
      repoMock.findOne.mockResolvedValueOnce({ id: 'div-2', name: 'HR' });

      await expect(service.update('div-1', { name: 'HR' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should hard remove division', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'div-1', name: 'Engineering' });
      await service.remove('div-1');
      expect(repoMock.remove).toHaveBeenCalledWith({ id: 'div-1', name: 'Engineering' });
    });
  });
});
