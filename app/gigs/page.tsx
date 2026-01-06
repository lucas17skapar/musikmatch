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
    image_url?: string | null;
};

export default function GigsPage() {
    const router = useRouter();
    const [gigs, setGigs] = useState<Gig[]>([]);
    const [msg, setMsg] = useState<string | null>(null);
    const [role, setRole] = useState<"musician" | "venue" | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;

            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", session.user.id)
                    .maybeSingle();

                setRole((profile?.role as "musician" | "venue" | undefined) ?? null);
            } else {
                setRole(null);
            }

            const { data: rows, error } = await supabase
                .from("gigs")
                .select("id,title,city,start_time,duration_minutes,budget_min,budget_max,image_url")
                .order("start_time", { ascending: true });

            if (error) setMsg(error.message);
            else setGigs((rows ?? []) as Gig[]);
        })();
    }, [router]);

    return (
        <AppShell>
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Gigs</h1>
                        <p className="text-sm text-slate-200/80">Utforska öppna spelningar och datum.</p>
                    </div>
                    {role === "venue" ? (
                        <Link
                            href="/gigs/new"
                            className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                        >
                            Skapa gig (venue)
                        </Link>
                    ) : null}
                </div>

                {msg && <p className="text-sm text-rose-100/90">{msg}</p>}

                <div className="grid gap-4">
                    {gigs.map((g) => (
                        <Link
                            key={g.id}
                            href={`/gigs/${g.id}`}
                            className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30 transition hover:-translate-y-1 hover:border-emerald-300/60 md:flex-row md:items-center"
                        >
                            {g.image_url ? (
                                <img
                                    src={g.image_url}
                                    alt={`Bild för ${g.title}`}
                                    className="h-32 w-full rounded-xl border border-white/10 object-cover md:h-24 md:w-40"
                                />
                            ) : null}
                            <div className="flex items-start justify-between gap-3 md:flex-1">
                                <div>
                                    <h2 className="text-lg font-semibold text-white group-hover:text-emerald-100">
                                        {g.title}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-200/80">
                                        {g.city ?? "—"} · {new Date(g.start_time).toLocaleString()} · {g.duration_minutes} min
                                    </p>
                                    {g.budget_min != null || g.budget_max != null ? (
                                        <p className="mt-3 text-sm text-slate-200/80">
                                            Budget: {g.budget_min ?? "?"}–{g.budget_max ?? "?"} kr/timme
                                        </p>
                                    ) : null}
                                </div>
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/90">
                                    ID {g.id}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
