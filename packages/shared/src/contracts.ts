import type { OperationGoal } from './operation-goals';
import type { UserRole } from './roles';
import type { ProductInventoryDto, UnitOfMeasureDto } from './inventory';
import type { BusinessSegment } from './setup';

/** Envelope padrao de listagens paginadas da API. */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface OrganizationAddressDto {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
}

export interface OrganizationDto {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  /** Logo em data URL, guardada na propria instalacao. */
  logo: string | null;
  segments: BusinessSegment[];
  address: OrganizationAddressDto;
  operationGoals: OperationGoal[];
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDto {
  user: AuthUserDto;
  organization: OrganizationDto;
}

export interface LoginResponseDto extends SessionDto {
  accessToken: string;
  refreshToken: string;
  /** Segundos de validade do access token, para agendar o refresh. */
  expiresIn: number;
}

export interface CategoryDto {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  categoryId: string | null;
  category: Pick<CategoryDto, 'id' | 'name'> | null;
  costPrice: number | null;
  salePrice: number;
  active: boolean;
  trackInventory: boolean;
  unit: UnitOfMeasureDto | null;
  /**
   * Estoque derivado do ledger. Sempre presente - para produto sem controle,
   * o status e NOT_TRACKED e a quantidade e zero.
   */
  inventory: ProductInventoryDto;
  createdAt: string;
  updatedAt: string;
}

/** Erro de uma linha especifica durante importacao de CSV. */
export interface ImportRowError {
  line: number;
  message: string;
  value?: string | null;
}

export interface ImportPreviewRow {
  line: number;
  valid: boolean;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  categoryName: string | null;
  unitCode: string | null;
  salePrice: number | null;
  costPrice: number | null;
  stockQuantity: number | null;
  minimumStock: number | null;
  errors: string[];
}

export interface ImportUploadResponseDto {
  importId: string;
  filename: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  /** Sugestao automatica de mapeamento coluna do arquivo -> campo do sistema. */
  suggestedMapping: ImportFieldMapping;
}

export type ImportFieldMapping = Partial<Record<ImportableProductField, string | null>>;

export interface ImportPreviewResponseDto {
  importId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
}

export interface ImportCommitResponseDto {
  importId: string;
  totalRows: number;
  createdRows: number;
  failedRows: number;
  errors: ImportRowError[];
}

export const IMPORTABLE_PRODUCT_FIELDS = [
  'name',
  'salePrice',
  'sku',
  'barcode',
  'categoryName',
  'unitCode',
  'costPrice',
  'stockQuantity',
  'minimumStock',
] as const;

export type ImportableProductField = (typeof IMPORTABLE_PRODUCT_FIELDS)[number];

export const IMPORTABLE_PRODUCT_FIELD_LABELS: Record<ImportableProductField, string> = {
  name: 'Nome do produto',
  salePrice: 'Preco de venda',
  sku: 'SKU / Codigo',
  barcode: 'Codigo de barras',
  categoryName: 'Categoria',
  unitCode: 'Unidade (UN, KG, CX...)',
  costPrice: 'Preco de custo',
  stockQuantity: 'Estoque inicial',
  minimumStock: 'Estoque minimo',
};

/** Campos sem os quais uma linha do CSV nao pode virar produto. */
export const REQUIRED_IMPORT_FIELDS: ImportableProductField[] = ['name', 'salePrice'];
