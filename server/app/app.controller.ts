import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ResearchRepository } from '../db/research.repository';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly repo: ResearchRepository,
  ) {}

  @Get('health')
  health() {
    return this.appService.health();
  }

  /**
   * Validation metrics for the hackathon form (Track 3 part 3):
   * completed research tasks, human decisions, skill coverage.
   */
  @Get('metrics')
  async metrics() {
    return this.repo.demoMetrics();
  }
}
