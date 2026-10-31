import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { asc, eq, inArray } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import {
  STAFF_ROLES,
  type User,
  type UserRole,
  users,
} from '../database/schema.js';
import { SALT_ROUNDS } from './users.constants.js';

export type PublicUser = Omit<User, 'password_hash'>;

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Removes the password hash before a user leaves the API. */
  static toPublic({ password_hash: _hash, ...user }: User): PublicUser {
    return user;
  }

  findByEmail(email: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  }

  async findById(id: number): Promise<PublicUser> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) throw new NotFoundException('User not found.');
    return UsersService.toPublic(user);
  }

  /**
   * Every staff account (managers and recruiters), sorted by last name,
   * without password hashes.
   */
  async findAll(): Promise<PublicUser[]> {
    const rows = await this.db.query.users.findMany({
      where: inArray(users.role, STAFF_ROLES),
      orderBy: [asc(users.last_name)],
    });
    return rows.map((row: User) => UsersService.toPublic(row));
  }

  async create(input: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  }): Promise<PublicUser> {
    const email = input.email.toLowerCase();
    if (await this.findByEmail(email)) {
      throw new ConflictException('Email is already registered.');
    }

    const [created] = await this.db
      .insert(users)
      .values({
        email,
        password_hash: await bcrypt.hash(input.password, SALT_ROUNDS),
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        role: input.role,
      })
      .returning();
    return UsersService.toPublic(created);
  }
}
