import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getAll(orgId: string) {
    return this.db.query('SELECT NOW() as time');
  }
}
