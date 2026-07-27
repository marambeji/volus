/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PublicHolidaysService } from './public-holidays.service';
import { PublicHoliday } from './entities/public-holiday.entity';

describe('PublicHolidaysService (Unit Tasks)', () => {
  let service: PublicHolidaysService;
  let mockRepo: any;

  beforeEach(async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicHolidaysService,
        { provide: getRepositoryToken(PublicHoliday), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PublicHolidaysService>(PublicHolidaysService);
  });

  describe('findAll with projection and leap year logic', () => {
    it('should project recurring holidays and skip February 29 on non-leap years', async () => {
      const mockHolidays = [
        {
          id: '1',
          name: 'New Year',
          date: '2020-01-01',
          isRecurring: true,
          countryId: 'country-id',
        },
        {
          id: '2',
          name: 'Leap Day Special',
          date: '2020-02-29',
          isRecurring: true,
          countryId: 'country-id',
        },
        {
          id: '3',
          name: 'One-off Event 2026',
          date: '2026-06-15',
          isRecurring: false,
          countryId: 'country-id',
        },
      ] as PublicHoliday[];

      const qb = mockRepo.createQueryBuilder('h');
      (qb.getMany as jest.Mock).mockResolvedValue(mockHolidays);

      // Non-leap year: 2027
      const res2027 = (await service.findAll({
        countryId: 'country-id',
        year: 2027,
      })) as PublicHoliday[];

      // Should include projected New Year (2027-01-01)
      // Should NOT include Leap Day Special (since 2027 is not a leap year)
      // Should NOT include One-off Event 2026 (year does not match 2027)
      expect(res2027).toHaveLength(1);
      expect(res2027[0].name).toBe('New Year');
      expect(res2027[0].date).toBe('2027-01-01');

      // Leap year: 2028
      const res2028 = (await service.findAll({
        countryId: 'country-id',
        year: 2028,
      })) as PublicHoliday[];

      // Should include projected New Year (2028-01-01)
      // Should include projected Leap Day Special (2028-02-29) because 2028 is a leap year
      // Should NOT include One-off Event 2026
      expect(res2028).toHaveLength(2);
      expect(
        res2028.some(
          (h) => h.name === 'Leap Day Special' && h.date === '2028-02-29',
        ),
      ).toBe(true);
    });

    it('should return holidays directly if no year filter is provided', async () => {
      const mockHolidays = [
        { id: '1', name: 'New Year', date: '2020-01-01', isRecurring: true },
      ] as PublicHoliday[];

      const qb = mockRepo.createQueryBuilder('h');
      (qb.getMany as jest.Mock).mockResolvedValue(mockHolidays);

      const res = (await service.findAll({
        countryId: 'country-id',
      })) as PublicHoliday[];
      expect(res).toHaveLength(1);
      expect(res[0].date).toBe('2020-01-01'); // unmodified
    });
  });
});
