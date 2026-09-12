import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResearchModule } from '../research/research.module';
import { DbModule } from '../db/db.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [DbModule, LlmModule, ResearchModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
