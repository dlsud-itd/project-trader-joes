
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /api/users — lists all staff accounts. Managers only; recruiters get 403. */
  @Get()
  @Roles('manager')
  list() {
    return this.users.findAll();
  }
}



