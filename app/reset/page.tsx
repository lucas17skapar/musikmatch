"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

export default function ResetPage() {
    const router = useRouter();
    const [pw, setPw] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [hasSession, setHasSession] = useState(false);

    useEffect(() => {
        (async () => {
            setMsg(null);

            // Try to establish a session from the recovery link.
            // Supabase may send either:
            //  - URL hash: #access_token=...&refresh_token=...&type=recovery
            //  - URL query: ?code=...
            try {
                const hash = window.location.hash?.startsWith("#")
                    ? window.location.hash.slice(1)
                    : "";

                if (hash) {
                    const hashParams = new URLSearchParams(hash);
                    const access_token = hashParams.get("access_token");
                    const refresh_token = hashParams.get("refresh_token");

                    if (access_token && refresh_token) {
                        await supabase.auth.setSession({ access_token, refresh_token });
                        // Clean up URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } else {
                    const url = new URL(window.location.href);
                    const code = url.searchParams.get("code");
                    if (code) {
                        await supabase.auth.exchangeCodeForSession(window.location.href);
                        // Clean up URL
                        url.searchParams.delete("code");
                        window.history.replaceState({}, document.title, url.pathname);
                    }
                }
            } catch (e) {
                // ignore and rely on getSession below
            }

            const { data } = await supabase.auth.getSession();
            const ok = Boolean(data.session);
            setHasSession(ok);
            setReady(true);

            if (!ok) {
                setMsg("Auth session missing. Öppna reset-länken från mailet (inte /reset manuellt), och se till att du är på http://localhost:3000.");
            }
        })();
    }, []);

    async function updatePassword() {
        setMsg(null);
        if (!ready) return setMsg("Vänta lite – laddar auth-session...");
        if (!hasSession) return setMsg("Auth session missing. Öppna reset-länken från mailet och försök igen.");
        if (pw.length < 6) return setMsg("Lösenordet måste vara minst 6 tecken.");

        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) return setMsg(error.message);

        setMsg("Lösenord uppdaterat. Du kan logga in igen.");
        router.replace("/login");
    }

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50";
    const primaryBtn =
        "inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70";

    return (
        <AppShell>
            <div className="mx-auto max-w-md">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/40">
                    <h1 className="text-2xl font-semibold text-white">Återställ lösenord</h1>
                    <p className="mt-2 text-sm text-slate-200/80">
                        Följ reset-länken från mailet. När sessionen är laddad kan du välja ett nytt lösenord.
                    </p>

                    <div className="mt-6 space-y-4">
                        {!ready ? (
                            <p className="text-sm text-slate-200/80">Laddar...</p>
                        ) : !hasSession ? (
                            <p className="text-sm text-rose-100/90">
                                Du måste öppna sidan via reset-länken i mailet.
                            </p>
                        ) : null}

                        <input
                            className={inputClass}
                            type="password"
                            placeholder="Nytt lösenord"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                        />

                        <button
                            className={primaryBtn}
                            onClick={updatePassword}
                            disabled={!ready || !hasSession}
                        >
                            Spara nytt lösenord
                        </button>
                    </div>

                    {msg && <p className="mt-4 text-sm text-emerald-100/90">{msg}</p>}
                </div>
            </div>
        </AppShell>
    );
}
