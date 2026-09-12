import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ResearchRepository } from './research.repository';

@Global()
@Module({
  providers: [PrismaService, ResearchRepository],
  exports: [PrismaService, ResearchRepository],
})
export class DbModule {}
