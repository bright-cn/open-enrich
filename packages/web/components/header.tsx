"use client";

import Link from "next/link";
import Image from "next/image";
import { GitBranch, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";

interface HeaderProps {
  onSettingsClick?: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        scrolled
          ? "bg-[#0a1628]/80 backdrop-blur-xl border-b border-[rgba(165,180,220,0.08)] shadow-[0_1px_24px_rgba(6,9,26,0.6)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src={withBasePath("/logo.png")}
              alt="Open Enrich"
              width={32}
              height={32}
              priority
              className="w-8 h-8"
            />
            <span className="text-[#f0f2f8] font-bold text-xl tracking-tight">
              Open
            </span>
            <span
              className="font-bold text-xl tracking-tight bg-gradient-to-r from-[#4B8BFF] to-[#22D3EE] bg-clip-text text-transparent -ml-1.5"
            >
              Enrich
            </span>
          </Link>
          <span className="flex items-center gap-2 text-[rgba(240,242,248,0.45)] text-sm tracking-wide">
            powered by
            <Image
              src={withBasePath("/BrightData_FramedLogo_PrimaryLight_80.png")}
              alt="Bright Data"
              width={120}
              height={30}
              priority
              className="h-6 w-auto opacity-75"
            />
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
            >
              <Settings size={18} />
            </button>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
          >
            <GitBranch size={18} />
          </a>
        </nav>
      </div>
    </header>
  );
}
