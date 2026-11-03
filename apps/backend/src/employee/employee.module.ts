import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { PhotoModule } from '../photo/photo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PhotoModule, AuthModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
