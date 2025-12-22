"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [msg, setMsg] = useState<string | null>(null);

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50";
    const primaryBtn =
        "inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70";
    const ghostBtn =
        "inline-flex justify-center rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60";

    async function signUp() {
        setMsg(null);
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) return setMsg(error.message);
        setMsg("Konto skapat. Kolla mailen om bekräftelse krävs.");
        router.replace("/onboarding");
    }

    async function signIn() {
        setMsg(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) return setMsg(error.message);
        setMsg("Inloggad.");
        router.replace("/onboarding");
    }

    async function resetPassword() {
        setMsg(null);
        if (!email.trim()) return setMsg("Skriv din email först.");

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: "http://localhost:3000/reset",
        });

        if (error) return setMsg(error.message);
        setMsg("Reset-länk skickad (om emailen finns). Kolla inkorgen.");
    }

    return (
        <AppShell>
            <div className="mx-auto max-w-md">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/40">
                    <h1 className="text-2xl font-semibold text-white">Logga in</h1>
                    <p className="mt-2 text-sm text-slate-200/80">Koppla upp dig för att hitta eller skapa gigs.</p>

                    <div className="mt-6 space-y-4">
                        <input
                            className={inputClass}
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            className={inputClass}
                            placeholder="Lösenord"
                            type="password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                        />

                        <div className="flex flex-wrap gap-2">
                            <button className={primaryBtn} onClick={signIn}>
                                Logga in
                            </button>
                            <button className={ghostBtn} onClick={signUp}>
                                Skapa konto
                            </button>
                            <button className={ghostBtn} onClick={resetPassword}>
                                Glömt lösenord?
                            </button>
                        </div>
                    </div>

                    {msg && <p className="mt-4 text-sm text-emerald-100/90">{msg}</p>}
                </div>
            </div>
        </AppShell>
    );
}
