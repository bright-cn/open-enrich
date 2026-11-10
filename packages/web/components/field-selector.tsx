"use client";

import { Check, Target, TrendingUp, MessageSquare, UserSearch, Globe, Wrench } from "lucide-react";

interface FieldSelectorProps {
  selectedFields: Set<string>;
  toggleField: (name: string) => void;
  selectCategory: (category: string) => void;
  clearCategory: (category: string) => void;
  getCategoryFields: (category: string) => Array<{ name: string; displayName: string; description: string }>;
  isCategoryFullySelected: (category: string) => boolean;
  categories: [string, string][];
  bundles: Array<{ id: string; name: string; description: string; fieldKeys: string[]; estimatedSeconds: number }>;
  selectBundle: (bundleId: string) => void;
  isBundleSelected: (bundleId: string) => boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  icp_qualification: <Target size={13} />,
  buying_signals: <TrendingUp size={13} />,
  personalization: <MessageSquare size={13} />,
  contact_data: <UserSearch size={13} />,
  social_web: <Globe size={13} />,
  custom: <Wrench size={13} />,
};

export function FieldSelector({
  selectedFields,
  toggleField,
  selectCategory,
  clearCategory,
  getCategoryFields,
  isCategoryFullySelected,
  categories,
  bundles,
  selectBundle,
  isBundleSelected,
}: FieldSelectorProps) {
  const filteredCategories = categories.filter(([key]) => key !== "custom");

  return (
    <div className="space-y-8">
      {/* Quick Start Bundles */}
      <div>
        <div className="text-[rgba(240,242,248,0.35)] text-[11px] font-semibold uppercase tracking-wider mb-3">
          Quick start
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {bundles.map((bundle) => {
            const selected = isBundleSelected(bundle.id);
            return (
              <button
                key={bundle.id}
                type="button"
                onClick={() => selectBundle(bundle.id)}
                className={`group p-4 rounded-xl border cursor-pointer transition-all duration-250 text-left active:scale-[0.98] ${
                  selected
                    ? "bg-[rgba(75,139,255,0.04)] border-[rgba(75,139,255,0.2)] shadow-[0_0_24px_rgba(75,139,255,0.04)]"
                    : "bg-[rgba(11,16,34,0.4)] border-[rgba(165,180,220,0.08)] hover:border-[rgba(165,180,220,0.15)] hover:bg-[rgba(11,16,34,0.55)]"
                }`}
              >
                <div className="text-[#f0f2f8] text-sm font-semibold">{bundle.name}</div>
                <div className="text-[rgba(240,242,248,0.35)] text-xs mt-1.5 leading-relaxed">{bundle.description}</div>
                <div className="text-[rgba(240,242,248,0.2)] text-[11px] mt-2.5 font-mono tabular-nums">
                  {bundle.fieldKeys.length} fields · ~{bundle.estimatedSeconds}s
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Sections */}
      {filteredCategories.map(([categoryKey, categoryLabel]) => {
        const fields = getCategoryFields(categoryKey);
        const fullySelected = isCategoryFullySelected(categoryKey);
        const icon = categoryIcons[categoryKey] ?? null;

        return (
          <div key={categoryKey}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[rgba(240,242,248,0.55)] text-xs font-semibold uppercase tracking-wider">
                <span className="text-[rgba(240,242,248,0.3)]">{icon}</span>
                <span>{categoryLabel}</span>
              </div>
              <button
                type="button"
                className="text-[11px] text-[#4B8BFF] hover:text-[#22D3EE] cursor-pointer transition-colors font-medium"
                onClick={() =>
                  fullySelected
                    ? clearCategory(categoryKey)
                    : selectCategory(categoryKey)
                }
              >
                {fullySelected ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {fields.map((field) => {
                const isSelected = selectedFields.has(field.name);
                return (
                  <button
                    key={field.name}
                    type="button"
                    title={field.description}
                    onClick={() => toggleField(field.name)}
                    className={`px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200 border text-left flex items-center gap-2 active:scale-[0.97] ${
                      isSelected
                        ? "bg-[rgba(75,139,255,0.06)] border-[rgba(75,139,255,0.2)] text-[#4B8BFF]"
                        : "bg-[rgba(11,16,34,0.3)] border-[rgba(165,180,220,0.06)] text-[rgba(240,242,248,0.45)] hover:border-[rgba(165,180,220,0.12)] hover:text-[rgba(240,242,248,0.65)]"
                    }`}
                  >
                    {isSelected && (
                      <Check size={13} className="shrink-0" />
                    )}
                    <span className="text-[13px]">{field.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
