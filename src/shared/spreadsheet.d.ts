export interface SpreadsheetCell { v?: string | number | boolean; t?: string; }
export interface SpreadsheetSheet {
  "!ref"?: string;
  [cell: string]: SpreadsheetCell | string | undefined;
}
export interface SpreadsheetWorkbook {
  SheetNames: string[];
  Sheets: Record<string, SpreadsheetSheet | undefined>;
}
export interface SpreadsheetReader {
  read(data: ArrayBuffer, options: { type: "array" }): SpreadsheetWorkbook;
  write(workbook: SpreadsheetWorkbook, options: { bookType: "xlsx"; type: "array" }): ArrayBuffer;
  utils: {
    decode_range(range: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_col(index: number): string;
    sheet_to_json(sheet: SpreadsheetSheet | undefined, options: { header: 1; defval?: string; raw?: boolean; blankrows?: boolean }): unknown[][];
    aoa_to_sheet(rows: readonly (readonly unknown[])[]): SpreadsheetSheet;
    book_new(): SpreadsheetWorkbook;
    book_append_sheet(workbook: SpreadsheetWorkbook, sheet: SpreadsheetSheet, name: string): void;
  };
}
declare global {
  interface Window { XLSX?: SpreadsheetReader; }
}
