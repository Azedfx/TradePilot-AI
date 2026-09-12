import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    });
    super({ adapter });
  }

  async onModuleInit() {
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Database connect attempt ${attempt}/${maxAttempts} failed: ${message.slice(0, 160)}`,
        );
        if (attempt === maxAttempts) throw error;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}