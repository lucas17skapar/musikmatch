"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Role = "musician" | "venue";

export default function OnboardingPage() {
    const router = useRouter();
    const [role, setRole] = useState<Role | null>(null);
    const [displayName, setDisplayName] = useState("");
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) return router.replace("/login");

            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", session.user.id)
                .maybeSingle();

            if (profile?.id) router.replace("/dashboard");
        })();
    }, [router]);

    async function save() {
        setMsg(null);

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return router.replace("/login");

        if (!role) return setMsg("Välj Musiker eller Krog / Venue.");
        if (displayName.trim().length < 2) return setMsg("Skriv ett visningsnamn (minst 2 tecken).");

        const { error } = await supabase.from("profiles").insert({
            id: session.user.id,
            role,
            display_name: displayName.trim(),
        });

        if (error) setMsg(error.message);
        else router.replace("/dashboard");
    }

    return (
        <AppShell>
            <div className="mx-auto max-w-xl">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/40">
                    <h1 className="text-2xl font-semibold text-white">Onboarding</h1>
                    <p className="mt-2 text-sm text-slate-200/80">Välj roll och spara ett visningsnamn.</p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={() => setRole("musician")}
                            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                role === "musician"
                                    ? "border-emerald-300/70 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25"
                                    : "border-white/15 bg-white/5 text-white hover:border-emerald-300/60"
                            }`}
                        >
                            Musiker
                        </button>
                        <button
                            onClick={() => setRole("venue")}
                            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                role === "venue"
                                    ? "border-cyan-300/70 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/25"
                                    : "border-white/15 bg-white/5 text-white hover:border-cyan-300/60"
                            }`}
                        >
                            Krog / Venue
                        </button>
                    </div>

                    <input
                        className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
                        placeholder="Visningsnamn (t.ex. 'Lucas Trio' eller 'Café Sakura')"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />

                    <button
                        onClick={save}
                        className="mt-4 inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                    >
                        Spara
                    </button>

                    {msg && <p className="mt-4 text-sm text-emerald-100/90">{msg}</p>}
                </div>
            </div>
        </AppShell>
    );
}
