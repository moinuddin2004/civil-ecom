import { StreamableFile } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type CellValue = string | number | null;

export interface SheetColumn<T> {
  header: string;
  /** Column width in characters. */
  width?: number;
  /** Whole rupees, shown with thousands separators (CLAUDE.md §15). */
  money?: boolean;
  value: (row: T) => CellValue;
}

/** A sheet whose rows are already turned into cells. */
export interface SheetData {
  name: string;
  columns: readonly { header: string; width?: number; money?: boolean }[];
  rows: AsyncIterable<CellValue[]> | Iterable<CellValue[]>;
}

/** Typed rows → cells, lazily (rows are read only while the file is written). */
export function sheet<T>(name: string, columns: readonly SheetColumn<T>[], rows: AsyncIterable<T> | Iterable<T>): SheetData {
  async function* cells(): AsyncIterable<CellValue[]> {
    for await (const row of rows) yield columns.map((column) => column.value(row));
  }
  return { name, columns, rows: cells() };
}

/**
 * An .xlsx download written as a stream (ExcelJS's streaming writer): each row goes out as soon as
 * it is read from the cursor, so a large export never sits in memory on the 4 GB server. Text
 * cells are stored as text, never as formulas.
 */
export function xlsxDownload(fileName: string, sheets: readonly SheetData[]): StreamableFile {
  const stream = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true, useSharedStrings: false });

  void (async () => {
    try {
      for (const data of sheets) {
        const worksheet = workbook.addWorksheet(data.name, { views: [{ state: 'frozen', ySplit: 1 }] });
        worksheet.columns = data.columns.map((column, index) => ({
          header: column.header,
          key: String(index),
          width: column.width ?? 18,
          ...(column.money && { style: { numFmt: '#,##0' } }),
        }));
        worksheet.getRow(1).font = { bold: true };
        for await (const cells of data.rows) worksheet.addRow(cells).commit();
        worksheet.commit();
      }
      await workbook.commit();
    } catch (error) {
      stream.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return new StreamableFile(stream, { type: XLSX_MIME, disposition: `attachment; filename="${fileName}"` });
}
