"use client";

import { useState } from "react";
import { Button, Input } from "@/lib/social-ui";
import type { CellValue, Sheet, WorkbookContent } from "@/lib/docs-types";

function toText(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Editor de planilla: una grilla editable por hoja (no un textarea TSV), para que
 * "editar Excel" se sienta como una hoja y no como texto.
 */
export function WorkbookEditor({
  workbook,
  onChange,
}: {
  workbook: WorkbookContent;
  onChange: (next: WorkbookContent) => void;
}) {
  const [active, setActive] = useState(0);
  const sheets = workbook.sheets;
  const sheet: Sheet | undefined = sheets[active];

  const replaceSheet = (next: Sheet) => {
    onChange({ sheets: sheets.map((current, index) => (index === active ? next : current)) });
  };

  if (!sheet) {
    return <p className="text-sm text-zinc-400">No hay hojas en esta planilla.</p>;
  }

  const setCell = (rowIndex: number, colIndex: number, value: string) => {
    const rows = sheet.rows.map((row, r) =>
      r === rowIndex ? sheet.columns.map((_c, c) => (c === colIndex ? value : (row[c] ?? null))) : row,
    );
    replaceSheet({ ...sheet, rows });
  };

  const setHeader = (colIndex: number, value: string) => {
    replaceSheet({ ...sheet, columns: sheet.columns.map((c, i) => (i === colIndex ? value : c)) });
  };

  const addRow = () => replaceSheet({ ...sheet, rows: [...sheet.rows, sheet.columns.map(() => "")] });
  const removeRow = (index: number) =>
    replaceSheet({ ...sheet, rows: sheet.rows.filter((_r, i) => i !== index) });
  const addColumn = () =>
    replaceSheet({
      ...sheet,
      columns: [...sheet.columns, `Columna ${sheet.columns.length + 1}`],
      rows: sheet.rows.map((row) => [...row, ""]),
    });
  const removeColumn = (index: number) =>
    replaceSheet({
      ...sheet,
      columns: sheet.columns.filter((_c, i) => i !== index),
      rows: sheet.rows.map((row) => row.filter((_c, i) => i !== index)),
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {sheets.map((s, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActive(index)}
            className={`rounded-full px-3 py-1 text-sm ${
              index === active ? "bg-emerald-600 text-white" : "border border-zinc-300 text-zinc-600"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <Input
        value={sheet.name}
        onChange={(e) => replaceSheet({ ...sheet, name: e.target.value })}
        placeholder="Nombre de la hoja"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50">
              {sheet.columns.map((column, index) => (
                <th key={index} className="p-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={column}
                      onChange={(e) => setHeader(index, e.target.value)}
                      className="w-full rounded border border-zinc-300 px-2 py-1 font-semibold"
                    />
                    <button
                      type="button"
                      title="Quitar columna"
                      onClick={() => removeColumn(index)}
                      className="text-xs text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-zinc-100">
                {sheet.columns.map((_column, colIndex) => (
                  <td key={colIndex} className="p-1">
                    <input
                      value={toText(row[colIndex] ?? null)}
                      onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                    />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button
                    type="button"
                    title="Quitar fila"
                    onClick={() => removeRow(rowIndex)}
                    className="text-xs text-red-500"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={addRow}>
          + Fila
        </Button>
        <Button variant="secondary" onClick={addColumn}>
          + Columna
        </Button>
      </div>
    </div>
  );
}
