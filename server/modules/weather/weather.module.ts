import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { GeoService } from './geo.service';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, SettingsModule, AuthModule],
  controllers: [WeatherController],
  providers: [WeatherService, GeoService],
})
export class WeatherModule {}
