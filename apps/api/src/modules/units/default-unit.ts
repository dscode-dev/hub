/**
 * Unidade padrao do sistema ("UN" - Unidade).
 *
 * O id e fixo porque a linha e criada pela migration `default_units`, nao por
 * seed opcional: ela existe em toda instalacao, inclusive na de producao que
 * nunca roda seed. Isso permite referencia-la sem consultar o banco antes.
 *
 * Produto sem unidade explicita cai aqui em vez de ficar nulo. Unidade nula
 * significaria "o sistema nao sabe o que esta contando", e e justamente a
 * unidade que decide se uma quantidade fracionada faz sentido.
 */
export const DEFAULT_UNIT_ID = '00000000-0000-4000-9000-000000000001';
