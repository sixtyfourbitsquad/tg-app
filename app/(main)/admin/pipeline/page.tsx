"use client";

import { useCallback, useState } from "react";
import axios from "axios";

interface LogRow {
  id: string;
  status: string;
  videos_fetched: number;
  errors: unknown;
  ran_at: string;
}

export default function AdminPipelinePage() {
  const [secret, setSecret] = useState("");
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    axios
      .get<{ logs: LogRow[] }>("/api/admin/pipeline", {
        headers: { "x-admin-secret": secret },
      })
      .then((r) => setLogs(r.data.logs ?? []))
      .catch((e) => {
        setLogs(null);
        setError(
          axios.isAxiosError(e) && e.response?.status === 401
            ? "Invalid secret"
            : e instanceof Error
              ? e.message
              : "Request failed"
        );
      })
      .finally(() => setLoading(false));
  }, [secret]);

  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary px-4 py-6" style={{ paddingTop: 72 }}>
      <h1 className="text-lg font-bold mb-1">Pipeline logs</h1>
      <p className="text-xs text-white/40 mb-4">
        Set <code className="text-white/60">ADMIN_SECRET</code> on the server, then paste it here. Nothing is stored.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin secret"
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <button
          type="button"
          onClick={() => load()}
          disabled={loading || !secret}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {loading ? "…" : "Load"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {logs && logs.length === 0 && <p className="text-sm text-white/40">No runs yet.</p>}

      {logs && logs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="p-2">Ran</th>
                <th className="p-2">Status</th>
                <th className="p-2">Videos</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="p-2 whitespace-nowrap">{new Date(l.ran_at).toLocaleString()}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2">{l.videos_fetched}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
