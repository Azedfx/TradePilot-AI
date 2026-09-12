import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'TradePilot AI',
      timestamp: new Date().toISOString(),
    };
  }
}
