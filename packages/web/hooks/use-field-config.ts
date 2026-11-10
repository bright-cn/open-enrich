"use client";

import { useState, useCallback } from "react";
import type { EnrichmentField, FieldCategory } from "@brightdata/enrich-core";
import { PRESET_FIELDS, QUICK_START_BUNDLES } from "@brightdata/enrich-core/presets";
export { PRESET_FIELDS, QUICK_START_BUNDLES };
export type { PresetField, FieldBundle } from "@brightdata/enrich-core/presets";

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  icp_qualification: "ICP Qualification",
  buying_signals: "Buying Signals",
  personalization: "Personalization",
  contact_data: "Contact Data",
  social_web: "Social & Web",
  custom: "Custom",
};

// ── Hook ───────────────────────────────────────────────────────────────

const DEFAULT_SELECTED = new Set([
  "industry",
  "employee_count",
  "headquarters",
  "funding_stage",
]);

export function useFieldConfig() {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(DEFAULT_SELECTED)
  );
  const [customFields, setCustomFields] = useState<EnrichmentField[]>([]);

  const toggleField = useCallback((name: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const selectCategory = useCallback((category: FieldCategory) => {
    const categoryFields = PRESET_FIELDS.filter((f) => f.category === category);
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const f of categoryFields) next.add(f.name);
      return next;
    });
  }, []);

  const clearCategory = useCallback((category: FieldCategory) => {
    const categoryFields = PRESET_FIELDS.filter((f) => f.category === category);
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const f of categoryFields) next.delete(f.name);
      return next;
    });
  }, []);

  const addCustomField = useCallback((field: EnrichmentField) => {
    setCustomFields((prev) => [...prev, field]);
    setSelectedFields((prev) => new Set([...prev, field.name]));
  }, []);

  const removeCustomField = useCallback((name: string) => {
    setCustomFields((prev) => prev.filter((f) => f.name !== name));
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const selectBundle = useCallback((bundleId: string) => {
    const bundle = QUICK_START_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return;
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const key of bundle.fieldKeys) next.add(key);
      return next;
    });
  }, []);

  const isBundleSelected = useCallback(
    (bundleId: string): boolean => {
      const bundle = QUICK_START_BUNDLES.find((b) => b.id === bundleId);
      if (!bundle) return false;
      return bundle.fieldKeys.every((key) => selectedFields.has(key));
    },
    [selectedFields]
  );

  const allFields: EnrichmentField[] = [
    ...PRESET_FIELDS.filter((f) => selectedFields.has(f.name)),
    ...customFields.filter((f) => selectedFields.has(f.name)),
  ];

  const categories = Object.entries(CATEGORY_LABELS) as [FieldCategory, string][];

  const getCategoryFields = (category: FieldCategory) =>
    PRESET_FIELDS.filter((f) => f.category === category);

  const isCategoryFullySelected = (category: FieldCategory) =>
    getCategoryFields(category).every((f) => selectedFields.has(f.name));

  return {
    selectedFields,
    customFields,
    allFields,
    categories,
    toggleField,
    selectCategory,
    clearCategory,
    addCustomField,
    removeCustomField,
    getCategoryFields,
    isCategoryFullySelected,
    selectBundle,
    isBundleSelected,
    CATEGORY_LABELS,
    QUICK_START_BUNDLES,
  };
}
