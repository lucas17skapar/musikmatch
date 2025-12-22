"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type Gig = {
    id: number;
    venue_id: string;
    title: string;
    description: string | null;
    city: string | null;
    start_time: string;
    duration_minutes: number;
    budget_min: number | null;
    budget_max: number | null;
};

type Application = {
    id: number;
    message: string | null;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
    musician_id: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    musician_name?: string | null;
};

type AppMessage = {
    id: number;
    application_id: number;
    sender_id: string;
    body: string;
    created_at: string;
    sender_name?: string | null;
};

type ApplicationRow = {
    id: number;
    message: string | null;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
    musician_id: string;
    profiles?: {
        contact_email?: string | null;
        contact_phone?: string | null;
        display_name?: string | null;
    } | null;
};

export default function GigDetailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams<{ id: string }>();
    const gigId = useMemo(() => Number(params.id), [params.id]);

    const [gig, setGig] = useState<Gig | null>(null);
    const [role, setRole] = useState<"musician" | "venue" | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const [applyMsg, setApplyMsg] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [profileContactEmail, setProfileContactEmail] = useState("");
    const [profileContactPhone, setProfileContactPhone] = useState("");
    const [apps, setApps] = useState<Application[]>([]);
    const [myApplication, setMyApplication] = useState<Application | null>(null);
    const [messages, setMessages] = useState<Record<number, AppMessage[]>>({});
    const [messageInputs, setMessageInputs] = useState<Record<number, string>>({});
    const [messageErrors, setMessageErrors] = useState<Record<number, string | null>>({});

    useEffect(() => {
        (async () => {
            setMsg(null);

            if (!Number.isFinite(gigId)) {
                setMsg("Ogiltigt gig-id.");
                return;
            }

            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) {
                router.replace("/login");
                return;
            }
            setUserId(session.user.id);

            const { data: profile, error: pErr } = await supabase
                .from("profiles")
                .select("role, contact_email, contact_phone, display_name")
                .eq("id", session.user.id)
                .maybeSingle();

            if (pErr) {
                setMsg(pErr.message);
                return;
            }

            if (!profile) {
                router.replace("/onboarding");
                return;
            }

            const roleVal = profile.role as "musician" | "venue";
            setRole(roleVal);
            setContactEmail(profile.contact_email ?? "");
            setContactPhone(profile.contact_phone ?? "");
            setProfileContactEmail(profile.contact_email ?? "");
            setProfileContactPhone(profile.contact_phone ?? "");
            setUserId(session.user.id);

            const { data: g, error: gErr } = await supabase
                .from("gigs")
                .select("*")
                .eq("id", gigId)
                .single();

            if (gErr) return setMsg(gErr.message);

            const gigRow = g as Gig;
            setGig(gigRow);

            const owner = roleVal === "venue" && gigRow.venue_id === session.user.id;
            setIsOwner(owner);

            if (owner) {
                const { data: a, error: aErr } = await supabase
                    .from("applications")
                    .select(
                        "id,message,status,created_at,musician_id,contact_email,contact_phone,profiles!applications_musician_id_fkey(display_name)"
                    )
                    .eq("gig_id", gigId)
                    .order("created_at", { ascending: false });

                if (aErr) {
                    setMsg(aErr.message);
                } else {
                    const musicianIds = Array.from(new Set((a ?? []).map((row: any) => row.musician_id)));
                    const profileMap: Record<string, { contact_email: string | null; contact_phone: string | null; display_name: string | null }> =
                        {};

                    if (musicianIds.length) {
                        const { data: profileRows } = await supabase
                            .from("profiles")
                            .select("id, contact_email, contact_phone, display_name")
                            .in("id", musicianIds);

                        (profileRows ?? []).forEach((p: any) => {
                            profileMap[p.id] = {
                                contact_email: p.contact_email ?? null,
                                contact_phone: p.contact_phone ?? null,
                                display_name: p.display_name ?? null,
                            };
                        });
                    }

                    const updates: { id: number; contact_email?: string | null; contact_phone?: string | null }[] = [];
                    const mapped =
                        (a ?? []).map((row: any) => {
                            const profileEmail = profileMap[row.musician_id]?.contact_email ?? null;
                            const profilePhone = profileMap[row.musician_id]?.contact_phone ?? null;
                            const profileName = profileMap[row.musician_id]?.display_name ?? row.profiles?.display_name ?? null;
                            const contactEmail = row.contact_email ?? profileEmail ?? null;
                            const contactPhone = row.contact_phone ?? profilePhone ?? null;

                            if ((!row.contact_email && profileEmail) || (!row.contact_phone && profilePhone)) {
                                updates.push({
                                    id: row.id,
                                    contact_email: contactEmail,
                                    contact_phone: contactPhone,
                                });
                            }

                            return {
                                id: row.id,
                                message: row.message,
                                status: row.status,
                                created_at: row.created_at,
                                musician_id: row.musician_id,
                                contact_email: contactEmail,
                                contact_phone: contactPhone,
                                musician_name: profileName,
                            };
                        }) ?? [];

                    if (updates.length) {
                        await supabase.from("applications").upsert(updates);
                    }
                    setApps(mapped);
                    // Load messages for each application
                    mapped.forEach((appRow) => fetchMessages(appRow.id));
                }
            }

            if (!owner && roleVal === "musician") {
                await fetchMyApplication(session.user.id);
            }
        })();
    }, [router, gigId]);

    async function fetchMessages(applicationId: number) {
        const { data, error } = await supabase
            .from("application_messages")
            .select("id,application_id,sender_id,body,created_at,profiles!application_messages_sender_id_fkey(display_name)")
            .eq("application_id", applicationId)
            .order("created_at", { ascending: true });

        if (error) {
            setMessageErrors((prev) => ({ ...prev, [applicationId]: error.message }));
            return;
        }

        const mapped =
            (data ?? []).map((row: any) => ({
                id: row.id,
                application_id: row.application_id,
                sender_id: row.sender_id,
                body: row.body,
                created_at: row.created_at,
                sender_name: row.profiles?.display_name ?? null,
            })) ?? [];

        setMessages((prev) => ({ ...prev, [applicationId]: mapped }));
        setMessageErrors((prev) => ({ ...prev, [applicationId]: null }));
    }

    async function fetchMyApplication(uid: string): Promise<Application | null> {
        const { data: myApp, error: myAppErr } = await supabase
            .from("applications")
            .select("id,message,status,contact_email,contact_phone")
            .eq("gig_id", gigId)
            .eq("musician_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!myAppErr && myApp) {
            const appRow = myApp as Application;
            setMyApplication(appRow);
            setApplyMsg(appRow.message ?? "");
            setContactEmail(appRow.contact_email ?? profileContactEmail);
            setContactPhone(appRow.contact_phone ?? profileContactPhone);
            fetchMessages(appRow.id);
            return appRow;
        } else {
            setMyApplication(null);
            setApplyMsg("");
            setContactEmail(profileContactEmail);
            setContactPhone(profileContactPhone);
            return null;
        }
    }

    async function getCurrentApplication(uid: string): Promise<Application | null> {
        const { data: myApp, error: myAppErr } = await supabase
            .from("applications")
            .select("id,message,status,contact_email,contact_phone")
            .eq("gig_id", gigId)
            .eq("musician_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (myAppErr || !myApp) return null;
        return myApp as Application;
    }

    async function sendMessage(applicationId: number, body: string) {
        const trimmed = body.trim();
        if (!trimmed) return;

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
            router.replace("/login");
            return;
        }

        const { error } = await supabase
            .from("application_messages")
            .insert({ application_id: applicationId, sender_id: session.user.id, body: trimmed });

        if (error) {
            setMessageErrors((prev) => ({ ...prev, [applicationId]: error.message }));
            return;
        }

        setMessageInputs((prev) => ({ ...prev, [applicationId]: "" }));
        fetchMessages(applicationId);
    }

    async function apply() {
        setMsg(null);

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return router.replace("/login");

        if (role !== "musician") return setMsg("Endast musiker kan ansöka.");

        // Re-check current application without overwriting user's inputs.
        const currentApp = await getCurrentApplication(session.user.id);

        // Update profile contact info so future ansökningar återanvänder den.
        const trimmedEmail = contactEmail.trim() || null;
        const trimmedPhone = contactPhone.trim() || null;

        // Update + return row to avoid silent RLS no-op.
        const { data: savedProfile, error: updateError } = await supabase
            .from("profiles")
            .update({ contact_email: trimmedEmail, contact_phone: trimmedPhone })
            .eq("id", session.user.id)
            .select("contact_email,contact_phone")
            .maybeSingle();

        if (updateError) {
            setMsg(updateError.message);
            return;
        }
        if (!savedProfile) {
            setMsg("Kunde inte spara kontaktuppgifter på profilen (saknar behörighet).");
            return;
        }
        setProfileContactEmail(savedProfile.contact_email ?? "");
        setProfileContactPhone(savedProfile.contact_phone ?? "");

        if (currentApp) {
            const { data: updatedApp, error: updateAppError } = await supabase
                .from("applications")
                .update({
                    message: applyMsg.trim() || null,
                    contact_email: trimmedEmail,
                    contact_phone: trimmedPhone,
                })
                .eq("id", currentApp.id)
                .select("id,message,status,contact_email,contact_phone")
                .maybeSingle();

            if (updateAppError) {
                setMsg(updateAppError.message);
                return;
            }
            if (!updatedApp) {
                setMsg("Kunde inte uppdatera ansökan (saknar behörighet).");
                return;
            }

            setMyApplication(updatedApp as unknown as Application);
            setApplyMsg(updatedApp.message ?? "");
            setContactEmail(updatedApp.contact_email ?? savedProfile.contact_email ?? "");
            setContactPhone(updatedApp.contact_phone ?? savedProfile.contact_phone ?? "");
            fetchMessages(updatedApp.id);
            setMsg("Ansökan uppdaterad.");
        } else {
            const insertPayload: any = {
                gig_id: gigId,
                musician_id: session.user.id,
                message: applyMsg.trim() || null,
                contact_email: trimmedEmail,
                contact_phone: trimmedPhone,
            };

            const { data: insertedApp, error: insertError } = await supabase
                .from("applications")
                .insert(insertPayload)
                .select("id,message,status,contact_email,contact_phone")
                .single();

            if (insertError) {
                setMsg(insertError.message);
                return;
            }

            setMyApplication(insertedApp as unknown as Application);
            setApplyMsg(insertedApp.message ?? "");
            setContactEmail(insertedApp.contact_email ?? savedProfile.contact_email ?? "");
            setContactPhone(insertedApp.contact_phone ?? savedProfile.contact_phone ?? "");
            fetchMessages(insertedApp.id);
            setMsg("Ansökan skickad.");
        }
    }

    async function setStatus(appId: number, status: "accepted" | "rejected") {
        setMsg(null);
        if (!isOwner) return setMsg("Du kan bara ändra status på dina egna gigs.");

        const { error } = await supabase
            .from("applications")
            .update({ status })
            .eq("id", appId);

        if (error) return setMsg(error.message);

        setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    }

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50";

    const backHref = searchParams?.get("from") === "my-applications" ? "/my-applications" : "/gigs";
    const backLabel = searchParams?.get("from") === "my-applications" ? "← Tillbaka till mina ansökningar" : "← Tillbaka till gigs";

    return (
        <AppShell>
            <div className="mx-auto max-w-4xl space-y-6">
                <nav className="flex flex-wrap items-center gap-3 text-sm text-emerald-100">
                    <Link className="rounded-full border border-white/10 px-3 py-2 hover:border-emerald-300/70" href={backHref}>
                        {backLabel}
                    </Link>
                </nav>

                {msg && <p className="text-sm text-rose-100/90">{msg}</p>}

                {!gig ? (
                    <p className="text-sm text-slate-200/80">Laddar...</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-[1.4fr,1fr]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.15em] text-emerald-200/80">Gig</p>
                                    <h1 className="text-2xl font-semibold text-white">{gig.title}</h1>
                                    <p className="mt-2 text-sm text-slate-200/80">
                                        {gig.city ?? "—"} · {new Date(gig.start_time).toLocaleString()} · {gig.duration_minutes} min
                                    </p>
                                </div>
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/90">
                                    #{gig.id}
                                </span>
                            </div>

                            {gig.budget_min != null || gig.budget_max != null ? (
                                <p className="mt-4 text-sm text-slate-200/80">
                                    Budget: {gig.budget_min ?? "?"}–{gig.budget_max ?? "?"}
                                </p>
                            ) : null}

                            {gig.description ? (
                                <p className="mt-4 whitespace-pre-line text-sm text-slate-200/90">{gig.description}</p>
                            ) : null}

                            {role === "musician" ? (
                                <section className="mt-6 space-y-3">
                                    <h2 className="text-lg font-semibold text-white">
                                        {myApplication ? "Uppdatera din ansökan" : "Ansök"}
                                    </h2>
                                    {myApplication ? (
                                        <p className="text-sm text-slate-200/80">
                                            Du har redan ansökt. Uppdatera text eller kontaktuppgifter nedan.
                                        </p>
                                    ) : null}
                                    <textarea
                                        className={`${inputClass} min-h-[120px]`}
                                        placeholder="Meddelande (valfritt)"
                                        value={applyMsg}
                                        onChange={(e) => setApplyMsg(e.target.value)}
                                    />
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/60">
                                                Kontaktmail (delas vid accept)
                                            </p>
                                            <input
                                                className={inputClass}
                                                placeholder="din@mail.se"
                                                value={contactEmail}
                                                onChange={(e) => setContactEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/60">
                                                Telefon (delas vid accept)
                                            </p>
                                            <input
                                                className={inputClass}
                                                placeholder="+46..."
                                                value={contactPhone}
                                                onChange={(e) => setContactPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={apply}
                                        className="inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                                    >
                                        {myApplication ? "Uppdatera ansökan" : "Skicka ansökan"}
                                    </button>

                                    {myApplication ? (
                                        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm font-semibold text-white">Konversation med venue</p>
                                            <p className="text-xs text-slate-200/70">
                                                Skicka meddelanden inför giget. Kontakt delas redan vid accept.
                                            </p>
                                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                                                {(messages[myApplication.id] ?? []).length === 0 ? (
                                                    <p className="text-xs text-slate-200/70">Inga meddelanden ännu.</p>
                                                ) : (
                                                    (messages[myApplication.id] ?? []).map((m) => (
                                                        <div key={m.id} className="text-xs text-slate-100">
                                                            <span className="font-semibold">
                                                                {m.sender_id === userId ? "Jag" : m.sender_name ?? "Venue"}
                                                            </span>
                                                            : {m.body}
                                                            <span className="ml-2 text-[10px] text-slate-300/80">
                                                                {new Date(m.created_at).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
                                                    placeholder="Skriv ett meddelande..."
                                                    value={messageInputs[myApplication.id] ?? ""}
                                                    onChange={(e) =>
                                                        setMessageInputs((prev) => ({ ...prev, [myApplication.id]: e.target.value }))
                                                    }
                                                />
                                                <button
                                                    onClick={() => sendMessage(myApplication.id, messageInputs[myApplication.id] ?? "")}
                                                    className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 shadow shadow-emerald-500/25 transition hover:-translate-y-0.5"
                                                >
                                                    Skicka
                                                </button>
                                            </div>
                                            {messageErrors[myApplication.id] ? (
                                                <p className="text-xs text-rose-100/90">{messageErrors[myApplication.id]}</p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </section>
                            ) : null}
                        </div>

                        {isOwner ? (
                            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30">
                                <h2 className="text-lg font-semibold text-white">Ansökningar</h2>
                                {apps.length === 0 ? (
                                    <p className="mt-2 text-sm text-slate-200/80">Inga ansökningar ännu.</p>
                                ) : (
                                    <ul className="mt-4 space-y-3">
                                        {apps.map((a) => (
                                            <li
                                            key={a.id}
                                            className="rounded-xl border border-white/10 bg-white/5 p-4"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-white">
                                                        Status: {a.status}
                                                    </p>
                                                    <span className="text-xs text-slate-200/70">
                                                        {new Date(a.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                {a.message ? (
                                                    <p className="mt-2 text-sm text-slate-200/80">{a.message}</p>
                                                ) : null}

                                                {a.status === "accepted" ? (
                                                    <div className="mt-3 space-y-1 rounded-xl border border-emerald-300/60 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-50">
                                                        <p className="font-semibold">
                                                            Kontakt{a.musician_name ? ` – ${a.musician_name}` : ""}
                                                        </p>
                                                        <p className="text-emerald-100/90">
                                                            {a.contact_email ?? "Ingen e-post angiven ännu."}
                                                        </p>
                                                        {a.contact_phone ? (
                                                            <p className="text-emerald-100/90">{a.contact_phone}</p>
                                                        ) : (
                                                            <p className="text-emerald-100/70">Ingen telefon angiven.</p>
                                                        )}
                                                    </div>
                                                ) : null}

                                                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                                                    <p className="text-xs font-semibold text-white">Konversation</p>
                                                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                                                        {(messages[a.id] ?? []).length === 0 ? (
                                                            <p className="text-xs text-slate-200/70">Inga meddelanden ännu.</p>
                                                        ) : (
                                                            (messages[a.id] ?? []).map((m) => (
                                                                <div key={m.id} className="text-xs text-slate-100">
                                                                    <span className="font-semibold">
                                                                        {m.sender_id === userId ? "Jag" : m.sender_name ?? "Musiker"}
                                                                    </span>
                                                                    : {m.body}
                                                                    <span className="ml-2 text-[10px] text-slate-300/80">
                                                                        {new Date(m.created_at).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <input
                                                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
                                                            placeholder="Skriv ett meddelande..."
                                                            value={messageInputs[a.id] ?? ""}
                                                            onChange={(e) =>
                                                                setMessageInputs((prev) => ({ ...prev, [a.id]: e.target.value }))
                                                            }
                                                        />
                                                        <button
                                                            onClick={() => sendMessage(a.id, messageInputs[a.id] ?? "")}
                                                            className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 shadow shadow-emerald-500/25 transition hover:-translate-y-0.5"
                                                        >
                                                            Skicka
                                                        </button>
                                                    </div>
                                                    {messageErrors[a.id] ? (
                                                        <p className="text-xs text-rose-100/90">{messageErrors[a.id]}</p>
                                                    ) : null}
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => setStatus(a.id, "accepted")}
                                                        className="rounded-full border border-emerald-300/70 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-slate-950"
                                                    >
                                                        Acceptera
                                                    </button>
                                                    <button
                                                        onClick={() => setStatus(a.id, "rejected")}
                                                        className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-rose-200/70 hover:text-rose-50"
                                                    >
                                                        Avslå
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ) : null}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
