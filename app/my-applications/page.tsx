"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type ApplicationRow = {
  id: number;
  gig_id: number;
  status: "pending" | "accepted" | "rejected";
  message: string | null;
  created_at: string;
  gigs?: {
    title: string;
    city: string | null;
    start_time: string;
  };
};

export default function MyApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setMsg(null);
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        if (active) setMsg(profileError.message);
        if (active) setLoading(false);
        return;
      }

      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      if (profile.role !== "musician") {
        if (active) setMsg("Endast musiker kan se egna ansökningar.");
        if (active) setLoading(false);
        return;
      }

      const { data: rows, error: appsError } = await supabase
        .from("applications")
        .select("id,gig_id,status,message,created_at,gigs (title,city,start_time)")
        .eq("musician_id", session.user.id)
        .order("created_at", { ascending: false });

      if (appsError) {
        if (active) setMsg(appsError.message);
        if (active) setLoading(false);
        return;
      }

      if (active) setApps((rows ?? []) as ApplicationRow[]);
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  async function deleteApplication(appId: number) {
    setSaving(true);
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setSaving(false);
      return router.replace("/login");
    }

    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", appId)
      .eq("musician_id", session.user.id);

    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }

    setApps((prev) => prev.filter((a) => a.id !== appId));
  }

  function statusClasses(status: ApplicationRow["status"]) {
    if (status === "accepted") return "bg-emerald-400 text-slate-950";
    if (status === "rejected") return "bg-rose-300 text-slate-950";
    return "bg-white/10 text-white";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Mina ansökningar</h1>
            <p className="text-sm text-slate-200/80">Håll koll på status och hoppa till giggen.</p>
          </div>
          <Link
            href="/gigs"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
          >
            Utforska fler gigs
          </Link>
        </div>

        {msg && <p className="text-sm text-rose-100/90">{msg}</p>}
        {loading ? <p className="text-sm text-slate-200/80">Laddar...</p> : null}
        {!loading && apps.length === 0 ? (
          <p className="text-sm text-slate-200/80">Inga ansökningar ännu.</p>
        ) : null}

        <div className="grid gap-4">
          {apps.map((a) => {
            const gigTitle = a.gigs?.title ?? `Gig #${a.gig_id}`;
            const gigMeta = a.gigs?.start_time
              ? `${a.gigs.city ?? "—"} · ${new Date(a.gigs.start_time).toLocaleString()}`
              : null;

            return (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-emerald-200/80">Ansökan</p>
                    <h2 className="text-lg font-semibold text-white">{gigTitle}</h2>
                    {gigMeta ? (
                      <p className="mt-1 text-sm text-slate-200/80">{gigMeta}</p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-200/60">Gig ID: {a.gig_id}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(a.status)}`}>
                    {a.status}
                  </span>
                </div>

                {a.message ? <p className="mt-3 text-sm text-slate-200/80">Meddelande: {a.message}</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
                  <span>Skickad: {new Date(a.created_at).toLocaleString()}</span>
                  <Link
                    className="rounded-full border border-white/10 px-3 py-2 font-semibold text-white transition hover:border-emerald-300/70 hover:text-emerald-100"
                    href={`/gigs/${a.gig_id}?from=my-applications`}
                  >
                    Visa gig →
                  </Link>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-full border border-rose-300/70 px-3 py-2 text-xs font-semibold text-rose-50 transition hover:-translate-y-0.5 hover:bg-rose-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => deleteApplication(a.id)}
                      disabled={saving}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
