import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { RecordHistoryService } from "./record-history.service";

/**
 * One record's history and its notes, shown at the foot of that record's screen.
 *
 * Deliberately *not* under `AuditController`, which is administrator-only.
 * That gate is right for the whole log — it spans every table and carries the
 * before and after of every changed field, which is the contents of tables the
 * caller may have no business reading. Narrowed to one record of one table, the
 * same rows are just what happened to something already on the caller's screen,
 * so the gate is that entity's own `read`. A trail only an administrator can
 * see is a trail nobody consults, which is the same as not having one.
 *
 * Writing a note needs `update` on the entity rather than `read`: leaving a
 * note is saying something about the record, and someone who may only look at
 * it should not be able to.
 */
@ApiTags("record-history")
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller("records")
export class RecordHistoryController {
  constructor(private readonly history: RecordHistoryService) {}

  @Get(":entity/:id/history")
  @ApiOperation({ summary: "What has been done to one record, newest first" })
  @ApiParam({ name: "entity", description: "Entity route segment, e.g. invoice-line" })
  @ApiParam({ name: "id", description: "The record's id" })
  async recordHistory(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Req() request: any,
  ) {
    await this.history.assertAccess(request.user, entity, "read");
    const data = await this.history.historyFor(entity, id);
    // `meta.total` because the trail's count badge reads it, the same way the
    // paged /audit response supplies it.
    return { data, meta: { total: data.length, page: 1, limit: data.length } };
  }

  @Get(":entity/:id/notes")
  @ApiOperation({ summary: "The notes people have left on one record" })
  async recordNotes(@Param("entity") entity: string, @Param("id") id: string, @Req() request: any) {
    await this.history.assertAccess(request.user, entity, "read");
    return { data: await this.history.notesFor(entity, id) };
  }

  @Post(":entity/:id/notes")
  @ApiOperation({ summary: "Leave a note on one record" })
  async addNote(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() body: { note?: string },
    @Req() request: any,
  ) {
    await this.history.assertAccess(request.user, entity, "update");

    const note = String(body?.note ?? "").trim();
    if (!note) throw new BadRequestException("A note needs some text.");
    if (note.length > 4000) throw new BadRequestException("A note is at most 4000 characters.");

    return this.history.addNote(entity, id, note, request.user);
  }
}
