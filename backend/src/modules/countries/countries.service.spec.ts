import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { Country } from './entities/country.entity';

import { DataSource } from 'typeorm';

describe('CountriesService', () => {
  let service: CountriesService;
  let repoMock: any;
  let dataSourceMock: any;
  let mockEm: any;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

    const emQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockEm = {
      createQueryBuilder: jest.fn().mockReturnValue(emQueryBuilder),
      query: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    dataSourceMock = {
      transaction: jest.fn(async (cb) => cb(mockEm)),
    };
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'c-1', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'c-1', ...entity })),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountriesService,
        {
          provide: getRepositoryToken(Country),
          useValue: repoMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<CountriesService>(CountriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new country with flag default', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const dto = { name: 'France', code: 'FR' } as any;

      const result = await service.create(dto);

      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: [{ name: 'France' }, { code: 'FR' }],
      });
      expect(result).toHaveProperty('id', 'c-1');
      expect(result.flag).toBe('FR');
    });

    it('should throw ConflictException if country name or code exists', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'c-existing', name: 'France' });
      await expect(service.create({ name: 'France', code: 'FR' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should query countries with search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'c-1', name: 'France' }], 1]);

      const res = await service.findAll({ q: 'Fra', page: 1, limit: 10, sortBy: 'name', sortOrder: 'ASC' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(country.name ILIKE :q OR country.code ILIKE :q)',
        { q: '%Fra%' }
      );
      expect(res.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return country if found', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'c-1', name: 'France' });
      const res = await service.findOne('c-1');
      expect(res.name).toBe('France');
    });

    it('should throw NotFoundException if not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('c-99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update country details successfully', async () => {
      repoMock.findOne.mockResolvedValueOnce({ id: 'c-1', name: 'France', code: 'FR' }); // findOne inside update
      const res = await service.update('c-1', { name: 'French Republic' });
      expect(res.name).toBe('French Republic');
    });

    it('should throw ConflictException if new country name exists', async () => {
      repoMock.findOne.mockResolvedValueOnce({ id: 'c-1', name: 'France', code: 'FR' });
      repoMock.findOne.mockResolvedValueOnce({ id: 'c-2', name: 'Spain' });

      await expect(service.update('c-1', { name: 'Spain' })).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if new country code exists', async () => {
      repoMock.findOne.mockResolvedValueOnce({ id: 'c-1', name: 'France', code: 'FR' });
      repoMock.findOne.mockResolvedValueOnce(null); // name check
      repoMock.findOne.mockResolvedValueOnce({ id: 'c-2', code: 'ES' }); // code check

      await expect(service.update('c-1', { name: 'France New', code: 'ES' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should deactivate employees and remove existing country', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'c-1', name: 'France' });
      await service.remove('c-1');
      expect(dataSourceMock.transaction).toHaveBeenCalled();
      expect(mockEm.query).toHaveBeenCalledWith(
        'DELETE FROM "countries" WHERE "id" = $1',
        ['c-1'],
      );
    });
  });
});
