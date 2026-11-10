"use client";

import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet } from "lucide-react";
import { motion } from "framer-motion";

interface CSVUploaderProps {
  onFileAccepted: (file: File) => void;
  parsedRows?: Record<string, string>[];
  parsedHeaders?: string[];
  error?: string | null;
  isParsing?: boolean;
}

export default function CSVUploader({
  onFileAccepted,
  parsedRows,
  parsedHeaders,
  error,
  isParsing,
}: CSVUploaderProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDropAccepted: (files) => {
      if (files[0]) {
        onFileAccepted(files[0]);
      }
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`group relative rounded-2xl p-14 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
          isDragActive
            ? "border-[#4B8BFF]/40 bg-[#4B8BFF]/[0.04] shadow-[0_0_40px_rgba(75,139,255,0.08)]"
            : "border-[rgba(165,180,220,0.1)] bg-[rgba(11,16,34,0.5)] hover:border-[rgba(165,180,220,0.18)] hover:bg-[rgba(11,16,34,0.65)]"
        }`}
      >
        <input {...getInputProps()} />

        {/* Glow orb behind icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-32 h-32 rounded-full transition-all duration-500 ${
              isDragActive
                ? "bg-[radial-gradient(circle,rgba(75,139,255,0.12),transparent_70%)] scale-110"
                : "bg-[radial-gradient(circle,rgba(75,139,255,0.04),transparent_70%)] group-hover:scale-105"
            }`}
          />
        </div>

        <div className="relative">
          <div
            className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${
              isDragActive
                ? "bg-[#4B8BFF]/10 text-[#4B8BFF]"
                : "bg-[rgba(165,180,220,0.06)] text-[rgba(240,242,248,0.3)] group-hover:text-[rgba(240,242,248,0.5)]"
            }`}
          >
            <Upload size={22} />
          </div>
          <p className="text-[rgba(240,242,248,0.5)] text-sm font-medium">
            {isDragActive ? "Drop your CSV file here" : "Drop a CSV file here, or click to browse"}
          </p>
          <p className="text-[rgba(240,242,248,0.25)] text-xs mt-2 font-mono">
            .csv up to 5 MB
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[#F87171] text-sm mt-4 px-1">
          {error}
        </div>
      )}

      {isParsing && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4B8BFF] animate-pulse" />
          <span className="text-[rgba(240,242,248,0.45)] text-sm">Parsing file...</span>
        </div>
      )}

      {parsedRows && parsedRows.length > 0 && parsedHeaders && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="mt-6 overflow-x-auto rounded-xl border border-[rgba(165,180,220,0.08)] bg-[rgba(11,16,34,0.4)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[rgba(11,16,34,0.6)]">
                  {parsedHeaders.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-[rgba(240,242,248,0.4)] text-[11px] font-semibold tracking-wider uppercase"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[rgba(165,180,220,0.05)]"
                  >
                    {parsedHeaders.map((header) => (
                      <td
                        key={header}
                        className="px-4 py-2.5 text-[rgba(240,242,248,0.65)] font-mono text-xs"
                      >
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3 justify-center">
            <FileSpreadsheet size={13} className="text-[rgba(240,242,248,0.3)]" />
            <span className="text-[rgba(240,242,248,0.4)] text-sm tabular-nums">
              {parsedRows.length} rows loaded
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
