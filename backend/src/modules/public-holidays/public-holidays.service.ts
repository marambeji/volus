import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublicHoliday } from './entities/public-holiday.entity';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function projectDateToYear(isoDate: string, year: number): string {
  const [, mm, dd] = isoDate.split('-');
  return `${year}-${mm}-${dd}`;
}

@Injectable()
export class PublicHolidaysService {
  constructor(
    @InjectRepository(PublicHoliday)
    private readonly repo: Repository<PublicHoliday>,
  ) {}

  private async checkDuplicate(
    dto: CreatePublicHolidayDto,
    excludeId?: string,
  ) {
    const [, mm, dd] = dto.date.split('-');
    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);

    // Validate Feb 29
    if (month === 2 && day === 29 && dto.isRecurring) {
      // Allowed; just projecting to leap years only
    }

    const qb = this.repo
      .createQueryBuilder('h')
      .where('h.country_id = :countryId', { countryId: dto.countryId });

    if (excludeId) qb.andWhere('h.id != :excludeId', { excludeId });

    if (dto.isRecurring) {
      // Recurring: unique by countryId + month + day
      qb.andWhere('h.is_recurring = true')
        .andWhere('EXTRACT(MONTH FROM h.date::date) = :month', { month })
        .andWhere('EXTRACT(DAY FROM h.date::date) = :day', { day });
    } else {
      // Non-recurring: unique by countryId + exact date
      qb.andWhere('h.is_recurring = false').andWhere('h.date = :date', {
        date: dto.date,
      });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException(
        dto.isRecurring
          ? 'A recurring holiday for this country on the same month/day already exists.'
          : 'A non-recurring holiday for this country on the same date already exists.',
      );
    }
  }

  async create(dto: CreatePublicHolidayDto): Promise<PublicHoliday> {
    await this.checkDuplicate({
      ...dto,
      isRecurring: dto.isRecurring ?? false,
    });
    const entity = this.repo.create({
      name: dto.name,
      date: dto.date,
      countryId: dto.countryId,
      isRecurring: dto.isRecurring ?? false,
    });
    return this.repo.save(entity);
  }

  async findAll(query: HolidayQueryDto): Promise<any[]> {
    const { countryId, year } = query;
    const qb = this.repo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.country', 'country');

    if (countryId) {
      // Include: holidays for the employee's specific country
      //       + holidays marked as "Global" (country name is 'Global', case-insensitive)
      qb.andWhere(
        "(h.country_id = :countryId OR LOWER(country.name) = 'global')",
        { countryId },
      );
    }

    const holidays = await qb.getMany();

    if (!year) return holidays;

    const results: any[] = [];
    for (const h of holidays) {
      const [storedYear, mm, dd] = h.date.split('-');
      const month = parseInt(mm, 10);
      const day = parseInt(dd, 10);

      if (!h.isRecurring) {
        // Non-recurring: only include if stored year matches query year
        if (parseInt(storedYear, 10) === year) {
          results.push(h);
        }
      } else {
        // Recurring: project to requested year, skip Feb 29 on non-leap years
        if (month === 2 && day === 29 && !isLeapYear(year)) continue;
        results.push({
          ...h,
          date: projectDateToYear(h.date, year),
          _projectedYear: year,
        });
      }
    }
    return results;
  }

  async findOne(id: string): Promise<PublicHoliday> {
    const h = await this.repo.findOne({
      where: { id },
      relations: { country: true },
    });
    if (!h) throw new NotFoundException(`Holiday #${id} not found`);
    return h;
  }

  async update(
    id: string,
    dto: UpdatePublicHolidayDto,
  ): Promise<PublicHoliday> {
    const holiday = await this.findOne(id);
    const merged = {
      name: dto.name ?? holiday.name,
      date: dto.date ?? holiday.date,
      countryId: dto.countryId ?? holiday.countryId,
      isRecurring: dto.isRecurring ?? holiday.isRecurring,
    };
    await this.checkDuplicate(merged, id);
    Object.assign(holiday, dto);
    return this.repo.save(holiday);
  }

  async remove(id: string): Promise<void> {
    const holiday = await this.findOne(id);
    await this.repo.remove(holiday);
  }
}
