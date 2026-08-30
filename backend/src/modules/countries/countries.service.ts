import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PublicHoliday } from '../public-holidays/entities/public-holiday.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { LeavePolicy } from '../policies/entities/leave-policy.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { EmployeeStatus } from '../../common/enums';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCountryDto): Promise<Country> {
    const existing = await this.countryRepo.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
    });
    if (existing) {
      throw new ConflictException(
        'A country with this name or code already exists.',
      );
    }
    const country = this.countryRepo.create({
      ...dto,
      flag: dto.flag || dto.code,
    });
    return this.countryRepo.save(country);
  }

  async findAll(query: PaginationQueryDto) {
    const {
      page = 1,
      limit = 20,
      q,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.countryRepo.createQueryBuilder('country');
    if (q) {
      qb.where('(country.name ILIKE :q OR country.code ILIKE :q)', {
        q: `%${q}%`,
      });
    }
    qb.orderBy(`country.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Country> {
    const country = await this.countryRepo.findOne({ where: { id } });
    if (!country) throw new NotFoundException(`Country #${id} not found`);
    return country;
  }

  async update(id: string, dto: UpdateCountryDto): Promise<Country> {
    const country = await this.findOne(id);
    if (dto.name && dto.name !== country.name) {
      const existing = await this.countryRepo.findOne({
        where: { name: dto.name },
      });
      if (existing) throw new ConflictException('Country name already in use.');
    }
    if (dto.code && dto.code !== country.code) {
      const existing = await this.countryRepo.findOne({
        where: { code: dto.code },
      });
      if (existing) throw new ConflictException('Country code already in use.');
    }
    Object.assign(country, dto);
    return this.countryRepo.save(country);
  }

  async remove(id: string): Promise<void> {
    const country = await this.findOne(id);

    // 1. Ensure foreign key column constraints outside transaction to avoid PostgreSQL aborts
    try {
      await this.dataSource.query(`ALTER TABLE "employees" ALTER COLUMN "country_id" DROP NOT NULL;`);
    } catch {}
    try {
      await this.dataSource.query(`ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_country";`);
      await this.dataSource.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL;`);
    } catch {}
    try {
      await this.dataSource.query(`ALTER TABLE "leave_policies" ALTER COLUMN "country_id" DROP NOT NULL;`);
      await this.dataSource.query(`ALTER TABLE "leave_policies" DROP CONSTRAINT IF EXISTS "FK_leave_policies_country";`);
      await this.dataSource.query(`ALTER TABLE "leave_policies" ADD CONSTRAINT "FK_leave_policies_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL;`);
    } catch {}
    try {
      await this.dataSource.query(`ALTER TABLE "public_holidays" DROP CONSTRAINT IF EXISTS "FK_public_holidays_country";`);
      await this.dataSource.query(`ALTER TABLE "public_holidays" ADD CONSTRAINT "FK_public_holidays_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE;`);
    } catch {}

    await this.dataSource.transaction(async (em) => {
      // 1. Deactivate employees and detach them from the deleted country (country_id = NULL)
      await em.query(
        `UPDATE "employees" SET "status" = $1, "country_id" = NULL WHERE "country_id" = $2`,
        [EmployeeStatus.INACTIVE, id],
      );

      // 2. Remove public holidays for this country
      await em.query(`DELETE FROM "public_holidays" WHERE "country_id" = $1`, [id]);

      // 3. Unlink approval workflows
      await em.query(`UPDATE "approval_workflows" SET "country_id" = NULL WHERE "country_id" = $1`, [id]);

      // 4. Remove leave policies for this country
      await em.query(`DELETE FROM "leave_policies" WHERE "country_id" = $1`, [id]);

      // 5. Delete the country
      await em.query(`DELETE FROM "countries" WHERE "id" = $1`, [id]);
    });
  }
}
