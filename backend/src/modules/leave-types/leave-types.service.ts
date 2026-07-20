import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly repo: Repository<LeaveType>,
  ) {}

  async create(dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException('Leave type key already exists.');
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(query: PaginationQueryDto) {
    const {
      page = 1,
      limit = 20,
      q,
      sortBy = 'displayOrder',
      sortOrder = 'ASC',
    } = query;
    const skip = (page - 1) * limit;
    const qb = this.repo.createQueryBuilder('lt');
    if (q) qb.where('lt.label ILIKE :q OR lt.key ILIKE :q', { q: `%${q}%` });
    qb.orderBy(`lt.${sortBy}`, sortOrder).skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<LeaveType> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`LeaveType #${id} not found`);
    return entity;
  }

  async findByKey(key: string): Promise<LeaveType | null> {
    return this.repo.findOne({ where: { key } });
  }

  async update(id: string, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
    const entity = await this.findOne(id);
    if (dto.key && dto.key !== entity.key) {
      const existing = await this.repo.findOne({ where: { key: dto.key } });
      if (existing)
        throw new ConflictException('Leave type key already in use.');
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.softRemove(entity);
  }
}
