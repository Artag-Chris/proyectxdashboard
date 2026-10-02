"use client";

import { Badge, Button, Input, Textarea } from "@/lib/social-ui";
import type { DocBlock, DocContent } from "@/lib/docs-types";

const REFINE_CHIPS = [
  "Hazlo más conciso",
  "Reordena por importancia",
  "Cambia a un tono formal",
  "Corrige la redacción",
];

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const BLOCK_LABEL: Record<DocBlock["type"], string> = {
  heading: "Título",
  paragraph: "Párrafo",
  list: "Lista",
  table: "Tabla",
  pagebreak: "Salto de página",
};

/**
 * Editor por bloques del contenido. Es un formulario controlado (mismo patrón que
 * ResumeEditor) sobre el JSON estructurado: lo que se edita acá es exactamente lo
 * que los renderers convierten a Word/PDF.
 */
export function ContentEditor({
  content,
  onChange,
  onRefine,
  refining,
}: {
  content: DocContent;
  onChange: (next: DocContent) => void;
  onRefine?: (instruction: string) => void;
  refining?: boolean;
}) {
  const updateBlock = (index: number, block: DocBlock) => {
    const blocks = content.blocks.map((current, i) => (i === index ? block : current));
    onChange({ ...content, blocks });
  };

  const removeBlock = (index: number) => {
    onChange({ ...content, blocks: content.blocks.filter((_, i) => i !== index) });
  };

  const addBlock = (block: DocBlock) => {
    onChange({ ...content, blocks: [...content.blocks, block] });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          value={content.title}
          placeholder="Título"
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
        <Input
          value={content.subtitle ?? ""}
          placeholder="Subtítulo (opcional)"
          onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        />
        <Input
          value={content.author ?? ""}
          placeholder="Autor (opcional)"
          onChange={(e) => onChange({ ...content, author: e.target.value })}
        />
        <Input
          value={content.date ?? ""}
          placeholder="Fecha (opcional)"
          onChange={(e) => onChange({ ...content, date: e.target.value })}
        />
      </div>

      {onRefine && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
          <span className="text-xs text-zinc-500">Asistente IA:</span>
          {REFINE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={refining}
              onClick={() => onRefine(chip)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
          {refining && <span className="text-xs text-zinc-400">Aplicando…</span>}
        </div>
      )}

      <div className="space-y-2">
        {content.blocks.map((block, index) => (
          <div key={index} className="rounded-lg border border-zinc-200 p-2">
            <div className="mb-1 flex items-center justify-between">
              <Badge tone="zinc">{BLOCK_LABEL[block.type]}</Badge>
              <div className="flex gap-1">
                <button
                  type="button"
                  title="Subir"
                  onClick={() => onChange({ ...content, blocks: move(content.blocks, index, index - 1) })}
                  className="rounded px-2 text-sm text-zinc-500 hover:bg-zinc-100"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Bajar"
                  onClick={() => onChange({ ...content, blocks: move(content.blocks, index, index + 1) })}
                  className="rounded px-2 text-sm text-zinc-500 hover:bg-zinc-100"
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Quitar"
                  onClick={() => removeBlock(index)}
                  className="rounded px-2 text-sm text-red-500 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            </div>

            {block.type === "heading" && (
              <div className="flex gap-2">
                <select
                  value={block.level}
                  onChange={(e) =>
                    updateBlock(index, { ...block, level: Number(e.target.value) as 1 | 2 | 3 })
                  }
                  className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <Input
                  value={block.text}
                  onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                />
              </div>
            )}

            {block.type === "paragraph" && (
              <Textarea
                rows={3}
                value={block.text}
                onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
              />
            )}

            {block.type === "list" && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={block.ordered}
                    onChange={(e) => updateBlock(index, { ...block, ordered: e.target.checked })}
                  />
                  Numerada
                </label>
                <Textarea
                  rows={3}
                  value={block.items.join("\n")}
                  placeholder="Un ítem por línea"
                  onChange={(e) =>
                    updateBlock(index, { ...block, items: e.target.value.split("\n") })
                  }
                />
              </div>
            )}

            {block.type === "table" && (
              <div className="space-y-1">
                <Input
                  value={block.headers.join(" | ")}
                  placeholder="Encabezados separados por |"
                  onChange={(e) =>
                    updateBlock(index, { ...block, headers: e.target.value.split("|").map((h) => h.trim()) })
                  }
                />
                <Textarea
                  rows={4}
                  value={block.rows.map((row) => row.join(" | ")).join("\n")}
                  placeholder="Una fila por línea, celdas separadas por |"
                  onChange={(e) =>
                    updateBlock(index, {
                      ...block,
                      rows: e.target.value
                        .split("\n")
                        .map((line) => line.split("|").map((cell) => cell.trim())),
                    })
                  }
                />
              </div>
            )}

            {block.type === "pagebreak" && (
              <p className="text-xs text-zinc-400">Se inserta un salto de página.</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => addBlock({ type: "paragraph", text: "" })}>
          + Párrafo
        </Button>
        <Button variant="secondary" onClick={() => addBlock({ type: "heading", level: 2, text: "" })}>
          + Título
        </Button>
        <Button variant="secondary" onClick={() => addBlock({ type: "list", ordered: false, items: [] })}>
          + Lista
        </Button>
        <Button variant="secondary" onClick={() => addBlock({ type: "table", headers: [], rows: [] })}>
          + Tabla
        </Button>
        <Button variant="secondary" onClick={() => addBlock({ type: "pagebreak" })}>
          + Salto
        </Button>
      </div>
    </div>
  );
}
