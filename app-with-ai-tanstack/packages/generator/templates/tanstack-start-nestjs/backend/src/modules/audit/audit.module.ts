import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseModule } from "../../database/database.module";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";
import { ImmudbService } from "./immudb.service";
import { RecordHistoryController } from "./record-history.controller";
import { RecordHistoryService } from "./record-history.service";

@Module({
  // DatabaseModule and Reflector are what the guards on AuditController resolve
  // against — SessionAuthGuard reads the caller's roles from the database,
  // RolesGuard reads the @Roles metadata.
  imports: [DatabaseModule],
  providers: [Reflector, ImmudbService, AuditService, AuditInterceptor, RecordHistoryService],
  controllers: [AuditController, RecordHistoryController],
  exports: [AuditService, AuditInterceptor, RecordHistoryService],
})
export class AuditModule {}
