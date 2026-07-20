import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division } from './entities/division.entity';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class DivisionsService {
  constructor(
    @InjectRepository(Division)
    private readonly divisionRepo: Repository<Division>,
  ) {}

  async create(dto: CreateDivisionDto): Promise<Division> {
    const existing = await this.divisionRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Division name already exists.');
    const division = this.divisionRepo.create(dto);
    return this.divisionRepo.save(division);
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
    const qb = this.divisionRepo.createQueryBuilder('division');
    if (q) qb.where('division.name ILIKE :q', { q: `%${q}%` });
    qb.orderBy(`division.${sortBy}`, sortOrder).skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Division> {
    const division = await this.divisionRepo.findOne({ where: { id } });
    if (!division) throw new NotFoundException(`Division #${id} not found`);
    return division;
  }

  async findByName(name: string): Promise<Division | null> {
    return this.divisionRepo.findOne({ where: { name } });
  }

  async update(id: string, dto: UpdateDivisionDto): Promise<Division> {
    const division = await this.findOne(id);
    if (dto.name && dto.name !== division.name) {
      const existing = await this.divisionRepo.findOne({
        where: { name: dto.name },
      });
      if (existing)
        throw new ConflictException('Division name already in use.');
    }
    Object.assign(division, dto);
    return this.divisionRepo.save(division);
  }

  async remove(id: string): Promise<void> {
    const division = await this.findOne(id);
    await this.divisionRepo.softRemove(division);
  }
}
