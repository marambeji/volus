import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
  ) {}

  async create(dto: CreateCountryDto): Promise<Country> {
    const existing = await this.countryRepo.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
      withDeleted: false,
    });
    if (existing) {
      throw new ConflictException(
        'A country with this name or code already exists.',
      );
    }
    const country = this.countryRepo.create(dto);
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
      qb.where('country.name ILIKE :q OR country.code ILIKE :q', {
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
    await this.countryRepo.softRemove(country);
  }
}
