import { Module } from '@nestjs/common';
import { ShippoController } from './shippo.controller';
import { ShippoService } from './shippo.service';

@Module({
  controllers: [ShippoController],
  providers: [ShippoService],
  exports: [ShippoService],
})
export class ShippoModule {}
