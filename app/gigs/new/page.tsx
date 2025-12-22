"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

export default function NewGigPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [city, setCity] = useState("");
    const [startTime, setStartTime] = useState(""); // datetime-local
    const [duration, setDuration] = useState(60);
    const [budgetMin, setBudgetMin] = useState<number | "">("");
    const [budgetMax, setBudgetMax] = useState<number | "">("");
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) return router.replace("/login");

            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .maybeSingle();

            if (!profile || profile.role !== "venue") {
                setMsg("Endast venue kan skapa gigs.");
            }
        })();
    }, [router]);

    async function createGig() {
        setMsg(null);

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return router.replace("/login");

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

        if (!profile || profile.role !== "venue") return setMsg("Endast venue kan skapa gigs.");

        if (title.trim().length < 3) return setMsg("Titel måste vara minst 3 tecken.");
        if (!startTime) return setMsg("Välj starttid.");

        const start = new Date(startTime).toISOString();

        const { data: inserted, error } = await supabase
            .from("gigs")
            .insert({
                venue_id: session.user.id,
                title: title.trim(),
                description: description.trim() || null,
                city: city.trim() || null,
                start_time: start,
                duration_minutes: duration,
                budget_min: budgetMin === "" ? null : budgetMin,
                budget_max: budgetMax === "" ? null : budgetMax,
            })
            .select("id")
            .single();

        if (error) return setMsg(error.message);

        router.replace(`/gigs/${inserted.id}`);
    }

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50";

    return (
        <AppShell>
            <div className="mx-auto max-w-2xl">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">Skapa gig</h1>
                            <p className="text-sm text-slate-200/80">Publicera datum och budget för ditt venue.</p>
                        </div>
                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/80">
                            Endast venue
                        </span>
                    </div>

                    {msg && <p className="mt-4 text-sm text-rose-100/90">{msg}</p>}

                    <div className="mt-6 space-y-4">
                        <input
                            className={inputClass}
                            placeholder="Titel (t.ex. 'Akustisk kväll')"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <input
                            className={inputClass}
                            placeholder="Stad (valfritt)"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        />
                        <textarea
                            className={`${inputClass} min-h-[100px]`}
                            placeholder="Beskrivning (valfritt)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <input
                                className={inputClass}
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                            <input
                                className={inputClass}
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value || "60", 10))}
                                min={15}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <input
                                className={inputClass}
                                type="number"
                                placeholder="Budget min"
                                value={budgetMin}
                                onChange={(e) => setBudgetMin(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <input
                                className={inputClass}
                                type="number"
                                placeholder="Budget max"
                                value={budgetMax}
                                onChange={(e) => setBudgetMax(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                        </div>

                        <button
                            onClick={createGig}
                            className="inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                        >
                            Skapa
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
