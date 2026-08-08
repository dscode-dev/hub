import { Module } from '@nestjs/common';
import { AddressController } from './address.controller';
import { CepLookupService } from './cep-lookup.service';

@Module({
  controllers: [AddressController],
  providers: [CepLookupService],
})
export class AddressModule {}
