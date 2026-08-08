import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { apiPath, createTestApp } from './harness';

/**
 * Consulta de CEP.
 *
 * A rede e simulada: um teste que depende de internet falha no computador
 * errado e deixa de significar alguma coisa. O que importa aqui e o contrato -
 * principalmente o caminho "sem internet", que precisa devolver 503 para a
 * interface liberar o preenchimento manual em vez de travar.
 */
describe('Consulta de CEP', () => {
  let app: INestApplication;
  const realFetch = global.fetch;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await app.close();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const mockFetch = (implementation: () => Promise<Response> | never) => {
    global.fetch = jest.fn(implementation);
  };

  const jsonResponse = (body: unknown, ok = true) =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
    } as Response);

  it('devolve o endereco quando o CEP existe', async () => {
    mockFetch(() =>
      jsonResponse({
        cep: '01310-100',
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        localidade: 'Sao Paulo',
        uf: 'sp',
      }),
    );

    const response = await request(app.getHttpServer())
      .get(apiPath('/address/cep/01310100'))
      .expect(200);

    expect(response.body).toEqual({
      zipCode: '01310-100',
      street: 'Avenida Paulista',
      district: 'Bela Vista',
      city: 'Sao Paulo',
      // UF sempre em maiuscula, independente do que o servico devolveu.
      state: 'SP',
    });
  });

  it('aceita CEP com mascara', async () => {
    mockFetch(() =>
      jsonResponse({ logradouro: 'Rua X', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' }),
    );

    const response = await request(app.getHttpServer())
      .get(apiPath('/address/cep/13010-000'))
      .expect(200);

    expect(response.body.city).toBe('Campinas');
  });

  it('devolve 404 quando o CEP nao existe', async () => {
    // O ViaCEP responde 200 com `erro: true` nesse caso.
    mockFetch(() => jsonResponse({ erro: true }));

    await request(app.getHttpServer()).get(apiPath('/address/cep/00000000')).expect(404);
  });

  it('rejeita CEP com quantidade de digitos invalida', async () => {
    await request(app.getHttpServer()).get(apiPath('/address/cep/123')).expect(400);
  });

  it('devolve 503 quando nao ha internet, sem derrubar a aplicacao', async () => {
    mockFetch(() => {
      throw new Error('getaddrinfo ENOTFOUND viacep.com.br');
    });

    const response = await request(app.getHttpServer())
      .get(apiPath('/address/cep/01310100'))
      .expect(503);

    // Mensagem precisa orientar o usuario a seguir manualmente.
    expect(response.body.message).toContain('manualmente');
  });

  it('devolve 503 quando o servico responde com erro', async () => {
    mockFetch(() => jsonResponse({}, false));

    await request(app.getHttpServer()).get(apiPath('/address/cep/01310100')).expect(503);
  });

  it('trata campos vazios do servico como ausentes', async () => {
    // CEP de logradouro unico costuma vir sem rua e sem bairro.
    mockFetch(() =>
      jsonResponse({ logradouro: '', bairro: '   ', localidade: 'Brasilia', uf: 'DF' }),
    );

    const response = await request(app.getHttpServer())
      .get(apiPath('/address/cep/70000000'))
      .expect(200);

    expect(response.body.street).toBeNull();
    expect(response.body.district).toBeNull();
    expect(response.body.city).toBe('Brasilia');
  });
});
