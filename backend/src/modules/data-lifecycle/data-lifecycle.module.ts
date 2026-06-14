import { Module } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';

@Module({
  providers: [DataLifecycleService],
})
export class DataLifecycleModule {}
