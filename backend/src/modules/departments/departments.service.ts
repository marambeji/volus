import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  async create(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.departmentRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Department name already exists.');
    const department = this.departmentRepo.create(dto);
    return this.departmentRepo.save(department);
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
    const qb = this.departmentRepo
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.headEmployee', 'headEmployee');
    if (q) qb.where('department.name ILIKE :q', { q: `%${q}%` });
    qb.orderBy(`department.${sortBy}`, sortOrder).skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.departmentRepo.findOne({
      where: { id },
      relations: { headEmployee: true },
    });
    if (!department) throw new NotFoundException(`Department #${id} not found`);
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findOne(id);
    if (dto.name && dto.name !== department.name) {
      const existing = await this.departmentRepo.findOne({
        where: { name: dto.name },
      });
      if (existing)
        throw new ConflictException('Department name already in use.');
    }
    Object.assign(department, dto);
    return this.departmentRepo.save(department);
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOne(id);
    await this.departmentRepo.remove(department);
  }
}
