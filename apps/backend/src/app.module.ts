import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PhotoModule } from './photo/photo.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomerModule } from './customer/customer.module';
import { EmployeeModule } from './employee/employee.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    PhotoModule,
    CatalogModule,
    CustomerModule,
    EmployeeModule,
    PaymentModule,
    OrderModule,
    StoreModule,
  ],
})
export class AppModule {}
