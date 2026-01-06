"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Gig = {
  id: number;
  title: string;
  city: string | null;
  start_time: string;
  duration_minutes: number;
  budget_min: number | null;
  budget_max: number | null;
};

export default function MyGigsPage() {
  const router = useRouter();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [appCounts, setAppCounts] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

      if (profile.role !== "venue") {
        if (active) setMsg("Endast venue kan se egna gig.");
        if (active) setLoading(false);
        return;
      }

      const { data: rows, error: gigsError } = await supabase
        .from("gigs")
        .select("id,title,city,start_time,duration_minutes,budget_min,budget_max")
        .eq("venue_id", session.user.id)
        .order("start_time", { ascending: false });

      if (gigsError) {
        if (active) setMsg(gigsError.message);
        if (active) setLoading(false);
        return;
      }

      const gigRows = (rows ?? []) as Gig[];
      if (active) setGigs(gigRows);

      if (gigRows.length) {
        const ids = gigRows.map((g) => g.id);
        const { data: appRows, error: appsError } = await supabase
          .from("applications")
          .select("gig_id")
          .in("gig_id", ids);

        if (appsError) {
          if (active) setMsg(appsError.message);
        } else if (appRows && active) {
          const counts: Record<number, number> = {};
          appRows.forEach((row) => {
            const gid = (row as { gig_id: number }).gig_id;
            counts[gid] = (counts[gid] ?? 0) + 1;
          });
          setAppCounts(counts);
        }
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  async function deleteGig(gigId: number) {
    if (!confirm("Vill du ta bort giget? Detta går inte att ångra.")) return;
    setDeletingId(gigId);
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setDeletingId(null);
      return router.replace("/login");
    }

    const { error } = await supabase
      .from("gigs")
      .delete()
      .eq("id", gigId)
      .eq("venue_id", session.user.id);

    setDeletingId(null);
    if (error) {
      setMsg(error.message);
      return;
    }

    setGigs((prev) => prev.filter((g) => g.id !== gigId));
    setAppCounts((prev) => {
      const next = { ...prev };
      delete next[gigId];
      return next;
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Mina gig</h1>
            <p className="text-sm text-slate-200/80">Gig som du har publicerat som venue.</p>
          </div>
          <Link
            href="/gigs/new"
            className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-300"
          >
            Skapa gig
          </Link>
        </div>

        {msg && <p className="text-sm text-rose-100/90">{msg}</p>}
        {loading ? <p className="text-sm text-slate-200/80">Laddar...</p> : null}

        {!loading && gigs.length === 0 ? (
          <p className="text-sm text-slate-200/80">Inga gig ännu. Skapa ditt första gig!</p>
        ) : null}

        <div className="grid gap-4">
          {gigs.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Link
                    href={`/gigs/${g.id}`}
                    className="text-lg font-semibold text-white transition hover:text-emerald-100"
                  >
                    {g.title}
                  </Link>
                  <p className="text-sm text-slate-200/80">
                    {g.city ?? "—"} · {new Date(g.start_time).toLocaleString()} · {g.duration_minutes} min
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/90">
                  {appCounts[g.id] ?? 0} ansökningar
                </span>
              </div>
              {g.budget_min != null || g.budget_max != null ? (
                <p className="mt-3 text-sm text-slate-200/80">
                  Budget: {g.budget_min ?? "?"}–{g.budget_max ?? "?"} kr/timme
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={`/gigs/${g.id}`}
                  className="text-sm font-semibold text-emerald-100/90 transition hover:text-emerald-100"
                >
                  Visa och hantera ansökningar →
                </Link>
                <button
                  onClick={() => deleteGig(g.id)}
                  disabled={deletingId === g.id}
                  className="rounded-full border border-rose-300/70 px-3 py-2 text-xs font-semibold text-rose-50 transition hover:-translate-y-0.5 hover:bg-rose-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingId === g.id ? "Tar bort..." : "Ta bort gig"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
