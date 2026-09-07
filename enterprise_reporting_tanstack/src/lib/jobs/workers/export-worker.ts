import fs from "node:fs/promises";
import path from "node:path";
import type { Job } from "bullmq";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import type { ExportJobData, JobResult } from "../queue";

const OUTPUT_DIR = process.env.JOB_OUTPUT_PATH || "./job-outputs";

export async function processExportJob(job: Job<ExportJobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { queryId, _userId, format = "csv", _parameters } = job.data;

  try {
    await job.updateProgress(10);

    // Get the saved query
    const db = getDb();
    const query = await db
      .selectFrom("saved_queries")
      .where("id", queryId)
      .selectAll()
      .executeTakeFirst();

    if (!query) {
      throw new Error(`Query not found: ${queryId}`);
    }

    await job.updateProgress(30);

    // Get the data source
    const dataSource = await db
      .selectFrom("data_sources")
      .where("id", query.data_source_id)
      .selectAll()
      .executeTakeFirst();

    if (!dataSource) {
      throw new Error("Data source not found");
    }

    await job.updateProgress(40);

    // Execute the query
    const connection = await getConnection(dataSource);
    const result = await connection.raw(query.sql_content);

    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(result)) {
      rows = result;
    } else if (result.rows) {
      rows = result.rows;
    }

    await job.updateProgress(60);

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const timestamp = Date.now();
    const filename = `export_${queryId}_${timestamp}.${format}`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Export based on format
    let rowCount = 0;
    if (format === "csv") {
      rowCount = await exportToCsv(rows, outputPath);
    } else if (format === "xlsx") {
      rowCount = await exportToExcel(rows, outputPath);
    } else if (format === "pdf") {
      rowCount = await exportToPdf(rows, outputPath);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    await job.updateProgress(100);

    const duration = Date.now() - startTime;

    return {
      success: true,
      outputLocation: outputPath,
      rowCount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Export job failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

async function exportToCsv(rows: Record<string, unknown>[], outputPath: string): Promise<number> {
  if (rows.length === 0) return 0;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape values containing commas or quotes
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"') || value.includes("\n"))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? "";
        })
        .join(",")
    ),
  ].join("\n");

  await fs.writeFile(outputPath, csvContent, "utf8");
  return rows.length;
}

async function exportToExcel(rows: Record<string, unknown>[], outputPath: string): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  if (rows.length === 0) {
    await workbook.xlsx.writeFile(outputPath);
    return 0;
  }

  // Add headers
  const headers = Object.keys(rows[0]);
  worksheet.addRow(headers);

  // Style headers
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  rows.forEach((row) => {
    worksheet.addRow(Object.values(row));
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.eachCell) {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) {
          maxLength = length;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    }
  });

  await workbook.xlsx.writeFile(outputPath);
  return rows.length;
}

async function exportToPdf(rows: Record<string, unknown>[], outputPath: string): Promise<number> {
  const doc = new jsPDF();

  if (rows.length === 0) {
    doc.save(outputPath);
    return 0;
  }

  const headers = Object.keys(rows[0]);
  const data = rows.map((row) => Object.values(row));

  autoTable(doc, {
    head: [headers],
    body: data,
    styles: {
      fontSize: 8,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textStyle: {
        color: 255,
      },
    },
  });

  doc.save(outputPath);
  return rows.length;
}

// Adapter for Trigger.dev tasks — accepts plain data instead of a BullMQ Job
export async function exportQueryData(data: ExportJobData): Promise<JobResult> {
  return processExportJob({ data, updateProgress: async () => {} } as any);
}
