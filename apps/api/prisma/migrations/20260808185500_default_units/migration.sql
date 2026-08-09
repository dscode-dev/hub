-- Unidades de medida padrao do sistema (organizationId NULL = disponivel a
-- todos os tenants). Entram por migration para que qualquer instalacao nasca
-- com elas, sem depender de seed - que e exclusivo de desenvolvimento.
--
-- IDs fixos: precisam ser estaveis entre instalacoes para que importacao e uma
-- futura sincronizacao possam referenciar a mesma unidade sem ambiguidade.
INSERT INTO "units_of_measure" ("id", "organizationId", "code", "name", "symbol", "allowsFraction", "active", "createdAt", "updatedAt") VALUES
  ('00000000-0000-4000-9000-000000000001', NULL, 'UN',  'Unidade',    'un',  0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000002', NULL, 'KG',  'Quilograma', 'kg',  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000003', NULL, 'G',   'Grama',      'g',   1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000004', NULL, 'L',   'Litro',      'L',   1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000005', NULL, 'ML',  'Mililitro',  'mL',  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000006', NULL, 'M',   'Metro',      'm',   1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000007', NULL, 'M2',  'Metro quadrado', 'm²', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000008', NULL, 'CX',  'Caixa',      'cx',  0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000009', NULL, 'PCT', 'Pacote',     'pct', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-9000-000000000010', NULL, 'PAR', 'Par',        'par', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
