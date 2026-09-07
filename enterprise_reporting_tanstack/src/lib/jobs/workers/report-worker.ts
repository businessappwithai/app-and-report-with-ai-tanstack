import fs from "node:fs/promises";
import path from "node:path";
import type { Job } from "bullmq";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { logAudit } from "@/lib/security/audit";
import type { JobResult, ReportJobData } from "../queue";

const OUTPUT_DIR = process.env.JOB_OUTPUT_PATH || "./job-outputs";

export async function processReportJob(job: Job<ReportJobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { reportId, userId, _parameters, format = "csv" } = job.data;

  try {
    await job.updateProgress(10);

    // Get report definition
    const db = getDb();
    const report = await db
      .selectFrom("report_definitions")
      .where("id", reportId)
      .selectAll()
      .executeTakeFirst();

    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    await job.updateProgress(20);

    // Get the saved query
    if (!report.saved_query_id) {
      throw new Error("Report has no associated query");
    }

    const query = await db
      .selectFrom("saved_queries")
      .where("id", report.saved_query_id)
      .selectAll()
      .executeTakeFirst();

    if (!query) {
      throw new Error("Query not found");
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
    const filename = `report_${reportId}_${timestamp}.${format}`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Export based on format
    switch (format) {
      case "csv":
        await exportToCSV(rows, outputPath);
        break;
      case "xlsx":
        await exportToXLSX(rows, report.name, outputPath);
        break;
      case "pdf":
        await exportToPDF(rows, report.name, outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await job.updateProgress(90);

    // Log the export
    await logAudit({
      userId,
      action: "export",
      resourceType: "report",
      resourceId: reportId,
      details: { format, rowCount: rows.length, outputPath },
    });

    await job.updateProgress(100);

    return {
      success: true,
      outputLocation: outputPath,
      rowCount: rows.length,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logAudit({
      userId,
      action: "execute",
      resourceType: "report",
      resourceId: reportId,
      details: { error: errorMessage },
    });

    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

async function exportToCSV(rows: Record<string, unknown>[], outputPath: string): Promise<void> {
  if (rows.length === 0) {
    await fs.writeFile(outputPath, "");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h];
          if (value === null || value === undefined) return "";
          const str = String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  await fs.writeFile(outputPath, csvLines.join("\n"));
}

async function exportToXLSX(
  rows: Record<string, unknown>[],
  reportName: string,
  outputPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportName);

  if (rows.length === 0) {
    await workbook.xlsx.writeFile(outputPath);
    return;
  }

  const headers = Object.keys(rows[0]);

  // Add header row
  worksheet.addRow(headers);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data rows
  rows.forEach((row) => {
    worksheet.addRow(headers.map((h) => row[h]));
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  await workbook.xlsx.writeFile(outputPath);
}

async function exportToPDF(
  rows: Record<string, unknown>[],
  reportName: string,
  outputPath: string
): Promise<void> {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(reportName, 14, 20);

  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  if (rows.length === 0) {
    doc.text("No data available", 14, 40);
    doc.save(outputPath);
    return;
  }

  const headers = Object.keys(rows[0]);
  const tableData = rows.map((row) =>
    headers.map((h) => {
      const value = row[h];
      if (value === null || value === undefined) return "";
      return String(value);
    })
  );

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  const pdfBuffer = doc.output("arraybuffer");
  await fs.writeFile(outputPath, Buffer.from(pdfBuffer));
}

// Adapter for Trigger.dev tasks — accepts plain data instead of a BullMQ Job
export async function generateReport(data: ReportJobData): Promise<JobResult> {
  return processReportJob({ data, updateProgress: async () => {} } as any);
}
