import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Free, dependency-light report generation (CSV + PDF).
 *
 * CSV is produced by hand (no external library needed) and PDF through
 * `pdf-lib`, which is pure JavaScript and therefore runs inside a Next.js Node
 * route handler without native bindings.
 */

export interface ReportColumn<T> {
  key: Extract<keyof T, string>;
  label: string;
  /** Relative width used by the PDF layout. */
  weight?: number;
  align?: "left" | "right";
  format?: (row: T) => string;
}

export interface ReportSpec<T> {
  title: string;
  subtitle?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  generatedBy?: string;
  generatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T extends Record<string, unknown>>(
  columns: ReportColumn<T>[],
  rows: T[]
): string {
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) =>
        csvCell(
          column.format ? column.format(row) : (row as Record<string, unknown>)[column.key] ?? ""
        )
      )
      .join(",")
  );
  // A UTF-8 BOM keeps Excel happy with non-ASCII characters.
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

const SYMBOL_MAP: Record<string, string> = {
  "✓": "Y",
  "✔": "Y",
  "✗": "X",
  "✘": "X",
  "→": "->",
  "←": "<-",
  "—": "-",
  "–": "-",
  "•": "-",
  "…": "...",
  "⚠": "!",
  "≥": ">=",
  "≤": "<=",
};

/** Standard PDF fonts only support WinAnsi — replace/strip anything else. */
export function pdfSafeText(input: string): string {
  return input
    .replace(/[✓✔✗✘→←—–•…⚠≥≤]/g, (char) => SYMBOL_MAP[char] ?? "-")
    .replace(/[^\u0020-\u00FF]/g, "");
}

interface FontLike {
  widthOfTextAtSize(text: string, size: number): number;
}

export function wrapText(
  text: string,
  font: FontLike,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function buildPdfReport<T extends Record<string, unknown>>(
  spec: ReportSpec<T>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;
  const MARGIN = 36;
  const ROW_GAP = 5;
  const BODY_SIZE = 8.5;
  const HEADER_SIZE = 9;

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const totalWeight =
    spec.columns.reduce((sum, column) => sum + (column.weight ?? 1), 0) || 1;
  const columnWidths = spec.columns.map(
    (column) => ((column.weight ?? 1) / totalWeight) * usableWidth
  );

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 16,
      width: usableWidth,
      height: 16,
      color: rgb(0.93, 0.94, 0.97),
    });

    let x = MARGIN + 4;
    spec.columns.forEach((column, index) => {
      page.drawText(pdfSafeText(column.label.toUpperCase()), {
        x,
        y: y - 12,
        size: HEADER_SIZE,
        font: bold,
        color: rgb(0.24, 0.28, 0.36),
      });
      x += columnWidths[index];
    });
    y -= 20;
  };

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawTableHeader();
  };

  /* ---------------- Title block ---------------- */
  page.drawText(pdfSafeText(spec.title), {
    x: MARGIN,
    y: y - 14,
    size: 16,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  });
  y -= 24;

  if (spec.subtitle) {
    page.drawText(pdfSafeText(spec.subtitle), {
      x: MARGIN,
      y: y - 10,
      size: 9.5,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    y -= 14;
  }

  const generatedAt = spec.generatedAt ?? new Date();
  page.drawText(
    pdfSafeText(
      `Generated ${generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC${
        spec.generatedBy ? ` by ${spec.generatedBy}` : ""
      } - ${spec.rows.length} record(s)`
    ),
    { x: MARGIN, y: y - 10, size: 8, font, color: rgb(0.5, 0.55, 0.62) }
  );
  y -= 26;

  drawTableHeader();

  /* ---------------- Rows ---------------- */
  for (const row of spec.rows) {
    const cellLines = spec.columns.map((column, index) => {
      const raw = column.format
        ? column.format(row)
        : String((row as Record<string, unknown>)[column.key] ?? "");
      return wrapText(pdfSafeText(raw || "-"), font, BODY_SIZE, columnWidths[index] - 8);
    });

    const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
    const rowHeight = lineCount * (BODY_SIZE + 2) + ROW_GAP;

    if (y - rowHeight < MARGIN + 20) newPage();

    let x = MARGIN + 4;
    cellLines.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x,
          y: y - 10 - lineIndex * (BODY_SIZE + 2),
          size: BODY_SIZE,
          font,
          color: rgb(0.13, 0.16, 0.22),
        });
      });
      x += columnWidths[index];
    });

    y -= rowHeight;

    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 2 },
      thickness: 0.4,
      color: rgb(0.87, 0.89, 0.92),
    });
  }

  if (spec.rows.length === 0) {
    page.drawText("No records matched the selected filters.", {
      x: MARGIN + 4,
      y: y - 12,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.52),
    });
  }

  return doc.save();
}