import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkflowDefinitionsService } from "./workflow-definitions.service";
import type { WorkflowDefinitionDto } from "./workflow-definitions.service";

/**
 * Workflow definitions decide what runs on every write, so they are guarded the
 * same way business rules are. This controller shipped with no guards at all:
 * `GET /api/workflow-definitions` returned every definition to anyone who
 * asked, and PUT/POST/DELETE let them be rewritten without signing in.
 */
@UseGuards(SessionAuthGuard, RolesGuard)
@Controller("workflow-definitions")
export class WorkflowDefinitionsController {
  constructor(private readonly service: WorkflowDefinitionsService) {}

  /**
   * A page of definitions. Defaults to 200, which is also the ceiling — a list
   * endpoint that can be asked for everything eventually is, and then times out.
   */
  @Get()
  findAll(
    @Query('entityName') entityName?: string,
    @Query('operation') operation?: string,
    @Query('isActive') isActive?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.findAll({
      entityName,
      operation,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      kind,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: WorkflowDefinitionDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  update(@Param('id') id: string, @Body() dto: Partial<WorkflowDefinitionDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
