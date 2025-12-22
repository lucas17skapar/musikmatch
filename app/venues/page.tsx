"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Venue = {
  id: string;
  display_name: string | null;
};

export default function VenuesPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (active) {
          setMsg("Endast musiker kan se registrerade venues.");
          setLoading(false);
        }
        return;
      }

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("role", "venue")
        .order("display_name", { ascending: true, nullsFirst: false });

      if (error) {
        if (active) setMsg(error.message);
      } else if (rows && active) {
        setVenues(rows as Venue[]);
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <AppShell containerClassName="py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Registrerade venues</h1>
            <p className="text-sm text-slate-200/80">Se företag som finns i Musikmatch.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-emerald-100/80">
            {venues.length} venues
          </span>
        </div>

        {msg && <p className="text-sm text-rose-100/90">{msg}</p>}
        {loading ? <p className="text-sm text-slate-200/80">Laddar...</p> : null}
        {!loading && !msg && venues.length === 0 ? (
          <p className="text-sm text-slate-200/80">Inga venues registrerade ännu.</p>
        ) : null}

        <div className="grid gap-3">
          {venues.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30"
            >
              <p className="text-lg font-semibold text-white">{v.display_name ?? "(utan namn)"}</p>
              <p className="mt-1 text-xs text-slate-200/70">ID: {v.id.slice(0, 8)}…</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
