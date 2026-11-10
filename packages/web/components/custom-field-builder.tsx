"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { EnrichmentField } from "@brightdata/enrich-core";

interface CustomFieldBuilderProps {
  customFields: EnrichmentField[];
  onAdd: (field: EnrichmentField) => void;
  onRemove: (name: string) => void;
}

export function CustomFieldBuilder({
  customFields,
  onAdd,
  onRemove,
}: CustomFieldBuilderProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleAdd() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName) return;

    const fieldName = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    onAdd({
      name: fieldName,
      displayName: trimmedName,
      description: trimmedDesc || `Custom field: ${trimmedName}`,
      type: "string",
      required: false,
      category: "custom",
    });

    setName("");
    setDescription("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[rgba(240,242,248,0.55)] text-xs font-semibold uppercase tracking-wider">
          Custom fields
        </h3>
        <span className="text-[rgba(240,242,248,0.2)] text-[11px] tabular-nums">
          {customFields.length} added
        </span>
      </div>

      {/* Existing custom fields */}
      {customFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customFields.map((field) => (
            <span
              key={field.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-[rgba(75,139,255,0.06)] border border-[rgba(75,139,255,0.15)] text-[#4B8BFF]"
            >
              {field.displayName}
              <button
                type="button"
                onClick={() => onRemove(field.name)}
                className="hover:text-[#f0f2f8] transition-colors"
                aria-label={`Remove ${field.displayName}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add new field */}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Field name (e.g. CEO Name)"
          className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.08)] text-[#f0f2f8] placeholder:text-[rgba(240,242,248,0.2)] outline-none focus:border-[rgba(75,139,255,0.3)] focus:shadow-[0_0_0_3px_rgba(75,139,255,0.06)] transition-all duration-200"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Description (optional)"
          className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.08)] text-[#f0f2f8] placeholder:text-[rgba(240,242,248,0.2)] outline-none focus:border-[rgba(75,139,255,0.3)] focus:shadow-[0_0_0_3px_rgba(75,139,255,0.06)] transition-all duration-200"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-3 py-2.5 rounded-xl bg-[rgba(165,180,220,0.04)] border border-[rgba(165,180,220,0.08)] text-[rgba(240,242,248,0.5)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.08)] transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
          aria-label="Add custom field"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
