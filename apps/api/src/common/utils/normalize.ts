/**
 * Normalizacao de texto para busca e unicidade.
 *
 * O SQLite compara texto byte a byte: `LIKE` ignora caixa apenas em ASCII e
 * `=` nem isso. Sem normalizacao explicita, "SOFÁ" nunca encontraria "sofá" e
 * "Eletronicos"/"eletrônicos" virariam duas categorias.
 *
 * A estrategia e guardar o valor original intacto (e o que o usuario ve) e
 * manter uma coluna derivada normalizada, usada para buscar e para garantir
 * unicidade. Nada aqui altera o dado exibido.
 */

/**
 * "Sofá Retrátil  " -> "sofa retratil"
 *
 * Aplica, nesta ordem: trim, minusculo, decomposicao Unicode (NFD), remocao
 * dos diacriticos e colapso de espacos repetidos.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    // Remove marcas de combinacao (acentos) separadas pelo NFD.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizacao de codigos (SKU).
 *
 * Alem de acento e caixa, descarta separadores: "SOF-01", "sof 01" e "sof01"
 * sao o MESMO codigo para quem digita no balcao. Isso tambem fortalece a
 * unicidade - dois produtos com "A-1" e "A1" seriam indistinguiveis na pratica
 * e passariam a se confundir no atendimento.
 */
export function normalizeCode(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizacao de codigo de barras.
 *
 * Nao usa `normalizeCode` de proposito: codigo de barras e literal. Apenas
 * removemos espacos acidentais da digitacao ou do leitor - caixa e acento nao
 * se aplicam a EAN/UPC/Code128, e alterar o valor quebraria a leitura.
 */
export function normalizeBarcode(value: string): string {
  return value.replace(/\s+/g, '');
}
