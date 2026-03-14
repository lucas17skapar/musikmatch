"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Profile = {
    role: "musician" | "venue";
    display_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    show_in_musician_list?: boolean | null;
};

function isMissingColumnError(
    error: { message?: string | null; code?: string | null } | null,
    columnName: string
) {
    const message = (error?.message ?? "").toLowerCase();
    return error?.code === "42703" || (message.includes(columnName.toLowerCase()) && message.includes("does not exist"));
}

export default function DashboardPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const [msgTone, setMsgTone] = useState<"success" | "error" | null>(null);
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [showInMusicianList, setShowInMusicianList] = useState(true);
    const [supportsMusicianVisibility, setSupportsMusicianVisibility] = useState(true);
    const [saving, setSaving] = useState(false);
    const [theme, setTheme] = useState<"dark" | "light">(() => {
        if (typeof window === "undefined") return "dark";
        return localStorage.getItem("musikmatch_theme") === "light" ? "light" : "dark";
    });

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) return router.replace("/login");

            const { data: p, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .maybeSingle();

            if (error) {
                setMsgTone("error");
                return setMsg(error.message);
            }
            if (!p) return router.replace("/onboarding");

            const prof = p as Profile;
            setProfile(prof);
            setContactEmail(prof.contact_email ?? "");
            setContactPhone(prof.contact_phone ?? "");
            setShowInMusicianList(prof.show_in_musician_list ?? true);
        })();
    }, [router]);

    async function signOut() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    async function saveProfile() {
        setMsg(null);
        setMsgTone(null);
        setSaving(true);

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
            setSaving(false);
            return router.replace("/login");
        }

        const trimmedEmail = contactEmail.trim() || null;
        const trimmedPhone = contactPhone.trim() || null;
        const baseUpdates = {
            contact_email: trimmedEmail,
            contact_phone: trimmedPhone,
        };
        const shouldPersistVisibility =
            profile?.role === "musician" && supportsMusicianVisibility;
        let visibilityColumnMissing = false;
        let visibilityWasSaved = shouldPersistVisibility;
        let error: { message?: string | null; code?: string | null } | null = null;

        const { error: updateError } = await supabase
            .from("profiles")
            .update(
                shouldPersistVisibility
                    ? { ...baseUpdates, show_in_musician_list: showInMusicianList }
                    : baseUpdates
            )
            .eq("id", session.user.id);
        error = updateError;

        if (error && shouldPersistVisibility && isMissingColumnError(error, "show_in_musician_list")) {
            visibilityColumnMissing = true;
            visibilityWasSaved = false;
            setSupportsMusicianVisibility(false);

            const { error: fallbackError } = await supabase
                .from("profiles")
                .update(baseUpdates)
                .eq("id", session.user.id);

            error = fallbackError;
        }

        setSaving(false);
        if (error) {
            setMsgTone("error");
            setMsg(error.message);
            return;
        }

        // Propagera kontaktinfo till alla ansökningar från musikern så venues ser den.
        await supabase
            .from("applications")
            .update({ contact_email: trimmedEmail, contact_phone: trimmedPhone })
            .eq("musician_id", session.user.id);

        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("musikmatch-contact-updated", {
                    detail: {
                        contact_email: trimmedEmail,
                        contact_phone: trimmedPhone,
                    },
                })
            );
        }

        setProfile((prev) =>
            prev
                ? {
                      ...prev,
                      contact_email: trimmedEmail,
                      contact_phone: trimmedPhone,
                      show_in_musician_list:
                          prev.role === "musician" && visibilityWasSaved
                              ? showInMusicianList
                              : prev.show_in_musician_list,
                  }
                : null
        );
        setMsgTone("success");
        setMsg(
            visibilityColumnMissing
                ? "Profil sparad, men synlighetsinställningen kräver databas-migrering."
                : "Profil sparad."
        );
    }

    function toggleTheme() {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        if (typeof window !== "undefined") {
            localStorage.setItem("musikmatch_theme", next);
            window.dispatchEvent(new CustomEvent("musikmatch-theme", { detail: next }));
        }
    }

    return (
        <AppShell>
            <div className="mx-auto max-w-xl">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/40">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
                            <p className="mt-2 text-sm text-slate-200/80">Profil och översikt.</p>
                        </div>
                        <button
                            onClick={signOut}
                            className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:border-emerald-300/70 hover:text-emerald-100"
                        >
                            Logga ut
                        </button>
                    </div>

                    {msg ? (
                        <p
                            className={`mt-4 text-sm ${
                                msgTone === "error" ? "text-rose-100/90" : "text-emerald-100/90"
                            }`}
                        >
                            {msg}
                        </p>
                    ) : null}

                    <div className="mt-6 space-y-3">
                        {profile ? (
                            <>
                                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">Visningsnamn</p>
                                    <p className="text-lg font-semibold text-white">
                                        {profile.display_name ?? "(utan namn)"}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">Roll</p>
                                    <p className="text-lg font-semibold text-white">{profile.role}</p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
                                    <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">
                                        Kontaktuppgifter (sparas på profilen)
                                    </p>
                                    <input
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
                                        placeholder="E-post (visas vid accepterad ansökan)"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                    />
                                    <input
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
                                        placeholder="Telefon (valfritt)"
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                    />
                                </div>
                                {profile.role === "musician" && supportsMusicianVisibility ? (
                                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
                                        <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">
                                            Synlighet i musikerkatalogen
                                        </p>
                                        <p className="text-sm text-slate-200/80">
                                            Styr om venues kan hitta dig på sidan där musiker filtreras efter
                                            kategorier.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowInMusicianList((value) => !value)}
                                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                                                showInMusicianList
                                                    ? "border-emerald-300/70 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25"
                                                    : "border-white/10 bg-white/5 text-white hover:border-emerald-300/60"
                                            }`}
                                        >
                                            {showInMusicianList
                                                ? "Synlig för venues"
                                                : "Dold för venues"}
                                            <span
                                                className={`h-4 w-7 rounded-full bg-white/10 p-1 transition ${
                                                    showInMusicianList ? "bg-emerald-500/80" : "bg-white/20"
                                                }`}
                                            >
                                                <span
                                                    className={`block h-2.5 w-2.5 rounded-full bg-white transition ${
                                                        showInMusicianList ? "translate-x-3" : ""
                                                    }`}
                                                />
                                            </span>
                                        </button>
                                        <p className="text-xs text-slate-300/70">
                                            {showInMusicianList
                                                ? "Din profil visas i katalogen för venues."
                                                : "Din profil döljs från katalogen tills du slår på synlighet igen."}
                                        </p>
                                    </div>
                                ) : null}
                                {profile.role === "musician" && !supportsMusicianVisibility ? (
                                    <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 space-y-2">
                                        <p className="text-xs uppercase tracking-[0.15em] text-amber-200/80">
                                            Synlighet i musikerkatalogen
                                        </p>
                                        <p className="text-sm text-amber-100/90">
                                            Synlighetsinställningen är inte tillgänglig ännu eftersom
                                            databas-kolumnen saknas.
                                        </p>
                                    </div>
                                ) : null}
                                <button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? "Sparar..." : "Spara profil"}
                                </button>
                                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
                                    <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">
                                        Tema
                                    </p>
                                    <button
                                        onClick={toggleTheme}
                                        className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/70"
                                    >
                                        Byt till {theme === "light" ? "mörkt" : "ljust"} läge
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-200/80">Laddar...</p>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
