"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Pencil, Check, Settings } from "lucide-react";

interface EmailNotificationToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
  onOpenSettings: () => void;
  isConfigured: boolean;
}

export function EmailNotificationToggle({
  enabled,
  onToggle,
  email,
  onEmailChange,
  onOpenSettings,
  isConfigured,
}: EmailNotificationToggleProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(email);

  useEffect(() => {
    setEditValue(email);
  }, [email]);

  const handleSaveEdit = useCallback(() => {
    onEmailChange(editValue);
    setEditing(false);
  }, [editValue, onEmailChange]);

  if (!isConfigured) {
    return (
      <div className="rounded-xl border border-[rgba(165,180,220,0.08)] bg-[rgba(11,16,34,0.5)] backdrop-blur-sm mb-4 px-4 py-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-[rgba(240,242,248,0.35)] hover:text-[#4B8BFF] transition-colors w-full"
        >
          <Mail size={13} className="shrink-0" />
          <span>Set up email notifications in</span>
          <Settings size={11} />
          <span>Settings</span>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(165,180,220,0.08)] bg-[rgba(11,16,34,0.5)] backdrop-blur-sm mb-4 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Mail size={13} className="text-[rgba(240,242,248,0.4)] shrink-0" />
          <span className="text-xs text-[rgba(240,242,248,0.5)]">Email me when done</span>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => onToggle(!enabled)}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${
            enabled ? "bg-[#4B8BFF]" : "bg-[rgba(165,180,220,0.15)]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-2.5 flex items-center gap-2">
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                className="flex-1 px-2 py-1 rounded-md bg-[rgba(11,16,34,0.5)] border border-[rgba(75,139,255,0.3)] text-xs text-[#f0f2f8] focus:outline-none font-mono"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 rounded text-[#34D399] hover:bg-[rgba(52,211,153,0.1)] transition-colors"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-[rgba(240,242,248,0.35)] font-mono truncate">
                {email}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="p-0.5 rounded text-[rgba(240,242,248,0.25)] hover:text-[rgba(240,242,248,0.6)] transition-colors shrink-0"
              >
                <Pencil size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
