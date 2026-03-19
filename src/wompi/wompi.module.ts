import { Module } from '@nestjs/common';
import { WompiService } from './wompi.service';
import { WompiController } from './wompi.controller';

@Module({
  providers: [WompiService],
  controllers: [WompiController],
  exports: [WompiService],
})
export class WompiModule {}
