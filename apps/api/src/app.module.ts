import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appConfig, authConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AddressModule } from './modules/address/address.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthController } from './health.controller';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { SetupModule } from './modules/setup/setup.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // Testes de integracao fazem muitos logins seguidos a partir do mesmo IP;
      // o rate limit e infraestrutura e nao faz parte do invariante testado.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    JwtModule.register({}),
    PrismaModule,
    AddressModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    CategoriesModule,
    ProductsModule,
    SetupModule,
    SystemModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: throttler -> autenticacao -> autorizacao.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
