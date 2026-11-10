"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Mail, Eye, EyeOff, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { withBasePath } from "@/lib/base-path";

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "http";
  headers?: Record<string, string>;
}

interface MCPSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MCPSettingsPanel({ open, onClose }: MCPSettingsPanelProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"sse" | "http">("sse");
  const [authHeader, setAuthHeader] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/mcp-servers"));
      if (res.ok) setServers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailSettings = useCallback(async () => {
    try {
      const res = await fetch(withBasePath("/api/email-settings"));
      if (res.ok) {
        const data = await res.json();
        setEmailAddress(data.email || "");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchServers();
      fetchEmailSettings();
    }
  }, [open, fetchServers, fetchEmailSettings]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers["Authorization"] = authHeader;

      const res = await fetch(withBasePath("/api/mcp-servers/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, transport, headers: Object.keys(headers).length ? headers : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: `Connected — ${data.toolCount} tool(s) available` });
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers["Authorization"] = authHeader;

      const res = await fetch(withBasePath("/api/mcp-servers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, transport, headers: Object.keys(headers).length ? headers : undefined }),
      });
      if (res.ok) {
        setName("");
        setUrl("");
        setTransport("sse");
        setAuthHeader("");
        setTestResult(null);
        setShowAdd(false);
        fetchServers();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
    fetchServers();
  };

  const handleSaveEmail = async () => {
    setEmailSaving(true);
    setEmailResult(null);
    try {
      const res = await fetch(withBasePath("/api/email-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: emailApiKey, email: emailAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult({ success: true, message: "Email settings saved" });
        setEmailApiKey("");
        setShowApiKey(false);
      } else {
        setEmailResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch (err) {
      setEmailResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    setEmailResult(null);
    try {
      const res = await fetch(withBasePath("/api/send-notification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailAddress,
          totalRows: 10,
          successCount: 9,
          errorCount: 1,
          totalCost: 0.015,
          duration: "1m 23s",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult({ success: true, message: "Test email sent — check your inbox" });
      } else {
        setEmailResult({ success: false, message: data.error || "Failed to send test" });
      }
    } catch (err) {
      setEmailResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setEmailTesting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-[#0a1628]/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0b1022] border-l border-[rgba(165,180,220,0.08)] z-50 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f0f2f8] tracking-tight">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-[rgba(240,242,248,0.5)] uppercase tracking-wider">External Data Sources</span>
          </div>
          <p className="text-xs text-[rgba(240,242,248,0.4)] mb-4">
            Connect MCP servers to enrich records from external databases, CRMs, and other data sources.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[rgba(240,242,248,0.3)]" />
            </div>
          ) : servers.length === 0 && !showAdd ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[rgba(240,242,248,0.35)]">
                No data sources connected
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#f0f2f8] truncate">
                      {server.name}
                    </p>
                    <p className="text-[11px] text-[rgba(240,242,248,0.3)] font-mono truncate">
                      {server.url}
                    </p>
                    <span className="text-[10px] text-[rgba(240,242,248,0.2)] uppercase tracking-wider">
                      {server.transport || "sse"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="p-1.5 rounded-lg text-[rgba(240,242,248,0.3)] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.08)] transition-all duration-200 ml-2 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Company CRM"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://mcp-server.example.com/sse"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Transport
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTransport("sse")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${
                        transport === "sse"
                          ? "bg-[rgba(75,139,255,0.12)] border-[rgba(75,139,255,0.3)] text-[#4B8BFF]"
                          : "bg-[rgba(11,16,34,0.5)] border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.4)] hover:text-[rgba(240,242,248,0.6)]"
                      }`}
                    >
                      SSE
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransport("http")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${
                        transport === "http"
                          ? "bg-[rgba(75,139,255,0.12)] border-[rgba(75,139,255,0.3)] text-[#4B8BFF]"
                          : "bg-[rgba(11,16,34,0.5)] border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.4)] hover:text-[rgba(240,242,248,0.6)]"
                      }`}
                    >
                      Streamable HTTP
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Authorization header (optional)
                  </label>
                  <input
                    type="password"
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    placeholder="Bearer your-token"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors font-mono text-xs"
                  />
                </div>

                {testResult && (
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                      testResult.success
                        ? "bg-[rgba(52,211,153,0.08)] text-[#34D399]"
                        : "bg-[rgba(248,113,113,0.08)] text-[#F87171]"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTest}
                    disabled={!url || testing}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.6)] hover:text-[#f0f2f8] hover:border-[rgba(165,180,220,0.2)] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                  >
                    {testing && <Loader2 size={12} className="animate-spin" />}
                    Test Connection
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!name || !url || adding}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-[#4B8BFF] text-white hover:bg-[#3A6FE0] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                  >
                    {adding && <Loader2 size={12} className="animate-spin" />}
                    Add Server
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setName("");
                      setUrl("");
                      setTransport("sse");
                      setAuthHeader("");
                      setTestResult(null);
                    }}
                    className="px-3 py-2 text-xs text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Notifications */}
          <div className="mt-6 pt-6 border-t border-[rgba(165,180,220,0.06)]">
            <div className="flex items-center gap-2 mb-3">
              <Mail size={14} className="text-[rgba(240,242,248,0.5)]" />
              <span className="text-xs font-semibold text-[rgba(240,242,248,0.5)] uppercase tracking-wider">Email Notifications</span>
            </div>
            <p className="text-xs text-[rgba(240,242,248,0.4)] mb-4">
              Get notified when your enrichment run completes. Requires a free{" "}
              <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-[#4B8BFF] hover:underline">
                Resend
              </a>{" "}
              API key.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                  Resend API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={emailApiKey}
                    onChange={(e) => setEmailApiKey(e.target.value)}
                    placeholder="re_..."
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgba(240,242,248,0.3)] hover:text-[rgba(240,242,248,0.6)] transition-colors"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors"
                />
              </div>

              {emailResult && (
                <div
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                    emailResult.success
                      ? "bg-[rgba(52,211,153,0.08)] text-[#34D399]"
                      : "bg-[rgba(248,113,113,0.08)] text-[#F87171]"
                  }`}
                >
                  {emailResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {emailResult.message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEmail}
                  disabled={!emailApiKey || !emailAddress || emailSaving}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-[#4B8BFF] text-white hover:bg-[#3A6FE0] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                >
                  {emailSaving && <Loader2 size={12} className="animate-spin" />}
                  Save
                </button>
                <button
                  onClick={handleTestEmail}
                  disabled={!emailAddress || emailTesting || !!emailApiKey}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.6)] hover:text-[#f0f2f8] hover:border-[rgba(165,180,220,0.2)] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                >
                  {emailTesting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Send Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {!showAdd && (
          <div className="px-6 py-4 border-t border-[rgba(165,180,220,0.06)]">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.6)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] hover:border-[rgba(165,180,220,0.15)] transition-all duration-200 active:scale-[0.98]"
            >
              <Plus size={16} />
              Add Data Source
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
