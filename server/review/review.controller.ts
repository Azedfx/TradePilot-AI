import { Controller, Get, Param } from '@nestjs/common';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** Generate (and persist) the auto-review report for a completed session. */
  @Get(':sessionId')
  report(@Param('sessionId') sessionId: string) {
    return this.review.review(sessionId);
  }

  /** Reusable checklist extracted from the review of a completed session. */
  @Get(':sessionId/checklist')
  checklist(@Param('sessionId') sessionId: string) {
    return this.review.checklist(sessionId);
  }
}
