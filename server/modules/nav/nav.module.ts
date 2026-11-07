import { Module } from '@nestjs/common';
import { NavController } from './nav.controller';
import { NavService } from './nav.service';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@server/database/database.module';

@Module({
  imports: [DatabaseModule, SettingsModule, AuthModule],
  controllers: [NavController],
  providers: [NavService],
})
export class NavModule {}
