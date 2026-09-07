import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { AuditService } from "./audit.service";
import type { AuditSearchParams, AuditSource } from "./audit.types";

@ApiTags("audit")
@ApiBearerAuth()
// The audit trail is administrative. It had SessionAuthGuard alone, so any
// signed-in account could page through every mutation in the application —
// including the old and new value of each changed field, which is the record
// contents of every table regardless of who may read those tables. Filtering it
// per caller would mean row-level rules the model has no way to express; the
// surface is reached from /admin/audit in the UI, so an administrator gate is
// the honest boundary.
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin", "administrator")
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Search and filter audit log" })
  async search(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('user_id') user_id?: string,
    @Query('user_email') user_email?: string,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('entity_id') entity_id?: string,
    @Query('source') source?: string,
    @Query('success') success?: string,
    @Query('search') search?: string
  ) {
    const params: AuditSearchParams = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(500, parseInt(limit, 10)) : 50,
      from,
      to,
      user_id: user_id || undefined,
      user_email: user_email || undefined,
      action: action || undefined,
      entity_type: entity_type || undefined,
      entity_id: entity_id || undefined,
      source: source as AuditSource | undefined,
      success: success === "true" ? true : success === "false" ? false : undefined,
      search: search || undefined,
    };
    return this.auditService.search(params);
  }

  @Get("entity-types")
  @ApiOperation({ summary: "List distinct entity types in audit log" })
  async getEntityTypes() {
    return this.auditService.getEntityTypes();
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify an audit record against immudb (tamper check)' })
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.verify(id);
  }
}
