-- Produtos cadastrados antes do dominio de estoque ficaram sem unidade.
-- Unidade nula significa nao saber o que esta sendo contado, e e ela que
-- decide se uma quantidade fracionada e valida - entao instalacoes que estao
-- sendo atualizadas recebem "UN", o mesmo padrao aplicado a produtos novos.
--
-- Roda depois de `default_units` porque a unidade referenciada precisa existir.
UPDATE products
SET "unitId" = '00000000-0000-4000-9000-000000000001'
WHERE "unitId" IS NULL;
