import { Test, TestingModule } from '@nestjs/testing';
import { ShippoController } from './shippo.controller';

describe('ShippoController', () => {
  let controller: ShippoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippoController],
    }).compile();

    controller = module.get<ShippoController>(ShippoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
