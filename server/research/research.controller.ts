import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchRequest } from './research.orchestrator';

@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  start(@Body() request: ResearchRequest) {
    return this.researchService.start(request);
  }

  @Get()
  list() {
    return this.researchService.list();
  }

  @Get(':id')
  status(@Param('id') id: string) {
    return this.researchService.status(id);
  }

  /** Track 3: human trader makes the final call on the AI thesis. */
  @Post(':id/decision')
  decide(
    @Param('id') id: string,
    @Body() body: { decision: 'accepted' | 'rejected' },
  ) {
    return this.researchService.decide(id, body.decision);
  }
}
