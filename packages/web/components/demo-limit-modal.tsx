"use client";

import { X, ExternalLink, GitFork } from "lucide-react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_REPO_URL, DEMO_BRIGHTDATA_SIGNUP_URL } from "@/lib/demo-mode/links";

export type DemoLimitModalProps =
  | { open: false; onClose: () => void }
  | { open: true; mode: "blocked"; onClose: () => void }
  | { open: true; mode: "partial"; granted: number; requested: number; onClose: () => void };

export default function DemoLimitModal(props: DemoLimitModalProps) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  let title: string;
  let body: string;
  if (open && props.mode === "partial") {
    title = "Demo limit reached";
    body = `We enriched ${props.granted} of the ${props.requested} rows you submitted — that's all that was left in this demo's quota. To enrich the rest (and more), clone the repo and sign up to Bright Data.`;
  } else {
    title = "You've reached the demo limit.";
    body = "This is just a demo. To enjoy the full power of enrichment without limits, clone the repo and sign up to Bright Data.";
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0a1628]/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 bg-[#0b1022]/97 border border-[rgba(165,180,220,0.1)] rounded-2xl w-full max-w-lg shadow-[0_24px_80px_rgba(6,9,26,0.9)] backdrop-blur-2xl"
          >
            <div className="px-6 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#f0f2f8] tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 rounded-xl text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <p className="text-sm text-[rgba(240,242,248,0.75)] leading-relaxed">{body}</p>

              <div className="flex flex-col gap-3">
                <a
                  href={DEMO_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[rgba(165,180,220,0.08)] border border-[rgba(165,180,220,0.12)] text-sm font-medium text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.14)] transition-colors"
                >
                  <GitFork className="w-4 h-4" />
                  Clone the repo
                  <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
                <a
                  href={DEMO_BRIGHTDATA_SIGNUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4B8BFF] text-sm font-semibold text-white hover:bg-[#3F7BE8] transition-colors"
                >
                  Sign up to Bright Data
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
