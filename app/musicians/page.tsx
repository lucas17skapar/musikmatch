"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Musician = {
  id: string;
  display_name: string | null;
  music_type?: string | null;
  rating?: number | null;
  bankid_verified?: boolean | null;
};

export default function MusiciansPage() {
  const router = useRouter();
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("alla");
  const [minRating, setMinRating] = useState<number>(0);
  const [bankIdOnly, setBankIdOnly] = useState(false);
  const inputClass =
    "w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm text-white outline-none transition hover:border-emerald-300/60 focus:border-emerald-300/60";
  const labelClass = "text-xs uppercase tracking-[0.15em] text-slate-200/60";
  const cardClass =
    "flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 min-h-[120px]";

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
        if (active) {
          setMsg("Endast venues kan se registrerade musiker.");
          setLoading(false);
        }
        return;
      }

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "musician")
        .order("display_name", { ascending: true, nullsFirst: false });

      if (error) {
        if (active) setMsg(error.message);
      } else if (rows && active) {
        setMusicians(rows as Musician[]);
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const availableTypes = Array.from(
    new Set(
      musicians
        .map((m) => m.music_type?.trim())
        .filter((t): t is string => Boolean(t))
    )
  ).sort();

  const visibleMusicians = musicians.filter((m) => {
    const matchesType = typeFilter === "alla" || (m.music_type?.toLowerCase() ?? "") === typeFilter;
    const ratingVal = typeof m.rating === "number" ? m.rating : 0;
    const matchesRating = ratingVal >= minRating;
    const matchesBankId = !bankIdOnly || Boolean(m.bankid_verified);
    return matchesType && matchesRating && matchesBankId;
  });

  return (
    <AppShell containerClassName="py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Registrerade musiker</h1>
            <p className="text-sm text-slate-200/80">Överblick över musiker i Musikmatch.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-emerald-100/80">
            {visibleMusicians.length} musiker
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`${cardClass} text-sm text-slate-200/80`}>
            <span className={labelClass}>Musiktyp</span>
            <div className="flex flex-1 items-center">
              <select
                className={inputClass}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="alla">Alla</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t.toLowerCase()}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className={`${cardClass} text-sm text-slate-200/80`}>
            <span className={labelClass}>Min. betyg</span>
            <div className="flex flex-1 items-center">
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </label>

          <div className={`${cardClass} text-sm text-slate-200/80`}>
            <span className={labelClass}>BankID-verifierad</span>
            <div className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => setBankIdOnly((v) => !v)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm transition ${
                  bankIdOnly
                    ? "border-emerald-300/70 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25"
                    : "border-white/10 bg-slate-900/70 text-white hover:border-emerald-300/60"
                }`}
              >
                Visa endast verifierade
                <span
                  className={`h-4 w-7 rounded-full bg-white/10 p-1 transition ${
                    bankIdOnly ? "bg-emerald-500/80" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`block h-2.5 w-2.5 rounded-full bg-white transition ${
                      bankIdOnly ? "translate-x-3" : ""
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </div>

        {msg && <p className="text-sm text-rose-100/90">{msg}</p>}
        {loading ? <p className="text-sm text-slate-200/80">Laddar...</p> : null}
        {!loading && !msg && visibleMusicians.length === 0 ? (
          <p className="text-sm text-slate-200/80">Inga musiker registrerade ännu.</p>
        ) : null}

        <div className="grid gap-3">
          {visibleMusicians.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30"
            >
              <p className="text-lg font-semibold text-white">{m.display_name ?? "(utan namn)"}</p>
              {m.music_type ? (
                <p className="mt-1 text-xs text-emerald-100/90">Musiktyp: {m.music_type}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
                <span>Betyg: {typeof m.rating === "number" ? m.rating.toFixed(1) : "–"}</span>
                {m.bankid_verified ? (
                  <span className="rounded-full border border-emerald-300/70 px-2 py-1 text-[11px] text-emerald-100">
                    BankID-verifierad
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-200/70">ID: {m.id.slice(0, 8)}…</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
