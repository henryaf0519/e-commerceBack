import { Test, TestingModule } from '@nestjs/testing';
import { ShippoService } from './shippo.service';

describe('ShippoService', () => {
  let service: ShippoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippoService],
    }).compile();

    service = module.get<ShippoService>(ShippoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
