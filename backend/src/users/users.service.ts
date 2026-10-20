
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { type User, type UserRole, users } from '../database/schema.js';

export type PublicUser = Omit<User, 'password_hash'>;

const SALT_ROUNDS = 10;

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
    const user = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) throw new NotFoundException('User not found.');
    return UsersService.toPublic(user);
  }

  /** Every staff account, sorted by last name, without password hashes. */
  async findAll(): Promise<PublicUser[]> {
    const rows = await this.db.query.users.findMany({
      orderBy: (u, { asc }) => [asc(u.last_name)],
    });
    return rows.map((row) => UsersService.toPublic(row));
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

