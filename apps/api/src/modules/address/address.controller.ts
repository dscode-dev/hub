import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CepLookupDto } from '@hub/shared';
import { Public } from '@/common/decorators/public.decorator';
import { CepLookupService } from './cep-lookup.service';

/**
 * Apoio ao preenchimento de endereco.
 *
 * Publica porque o wizard de primeiro acesso roda antes de existir usuario.
 * O backend so escuta em loopback, entao a exposicao fica restrita a maquina -
 * ainda assim o limite de requisicoes evita que um bug de UI vire enxurrada de
 * chamadas ao servico externo.
 */
@ApiTags('address')
@Controller('address')
export class AddressController {
  constructor(private readonly cepLookupService: CepLookupService) {}

  @Public()
  @Get('cep/:cep')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Consulta um CEP brasileiro',
    description:
      'Responde 404 para CEP inexistente e 503 quando nao ha internet - nesse caso a interface segue com preenchimento manual.',
  })
  lookup(@Param('cep') cep: string): Promise<CepLookupDto> {
    return this.cepLookupService.lookup(cep);
  }
}
