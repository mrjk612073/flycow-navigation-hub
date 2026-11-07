import { Global, Module } from '@nestjs/common';
import { DatabaseService, SQLITE_DATABASE } from './database.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: SQLITE_DATABASE,
      useFactory: (dbService: DatabaseService) => dbService.getDb(),
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, SQLITE_DATABASE],
})
export class DatabaseModule {}
