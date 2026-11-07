import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@server/database/database.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
