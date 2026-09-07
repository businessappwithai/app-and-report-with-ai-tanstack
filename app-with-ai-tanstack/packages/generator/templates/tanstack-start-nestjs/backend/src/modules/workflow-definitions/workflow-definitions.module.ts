import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { WorkflowDefinitionsController } from "./workflow-definitions.controller";
import { WorkflowDefinitionsService } from "./workflow-definitions.service";

@Module({
  imports: [DatabaseModule],
  controllers: [WorkflowDefinitionsController],
  providers: [WorkflowDefinitionsService],
  exports: [WorkflowDefinitionsService],
})
export class WorkflowDefinitionsModule {}
