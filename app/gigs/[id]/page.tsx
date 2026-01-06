"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    image_url?: string | null;
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
    contact_email: string | null;
    contact_phone: string | null;
};

type ApplicationMessageRow = {
    id: number;
    application_id: number;
    sender_id: string;
    body: string;
    created_at: string;
};

type ApplicationMessageInsertRow = {
    id: number;
    application_id: number;
    sender_id: string;
    body: string;
    created_at: string;
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
    const [contactTouched, setContactTouched] = useState(false);
    const [apps, setApps] = useState<Application[]>([]);
    const [myApplication, setMyApplication] = useState<Application | null>(null);
    const [messages, setMessages] = useState<Record<number, AppMessage[]>>({});
    const [messageInputs, setMessageInputs] = useState<Record<number, string>>({});
    const [messageErrors, setMessageErrors] = useState<Record<number, string | null>>({});

    const appendMessage = useCallback((message: AppMessage) => {
        setMessages((prev) => {
            const existing = prev[message.application_id] ?? [];
            if (existing.some((item) => item.id === message.id)) return prev;
            return {
                ...prev,
                [message.application_id]: [...existing, message],
            };
        });
    }, []);

    const fetchMessages = useCallback(async (applicationId: number) => {
        const { data, error } = await supabase
            .from("application_messages")
            .select("id,application_id,sender_id,body,created_at")
            .eq("application_id", applicationId)
            .order("created_at", { ascending: true });

        if (error) {
            setMessageErrors((prev) => ({ ...prev, [applicationId]: error.message }));
            return;
        }

        const messageRows = (data ?? []) as unknown as ApplicationMessageRow[];
        const mapped = messageRows.map((row) => ({
            id: row.id,
            application_id: row.application_id,
            sender_id: row.sender_id,
            body: row.body,
            created_at: row.created_at,
            sender_name: null,
        }));

        setMessages((prev) => {
            const existing = prev[applicationId] ?? [];
            const merged = [...existing, ...mapped];
            const deduped = Array.from(
                new Map(merged.map((item) => [item.id, item])).values()
            ).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return { ...prev, [applicationId]: deduped };
        });
        setMessageErrors((prev) => ({ ...prev, [applicationId]: null }));
    }, []);

    const applicationIds = useMemo(() => {
        if (apps.length > 0) return apps.map((app) => app.id);
        if (myApplication) return [myApplication.id];
        return [];
    }, [apps, myApplication]);

    useEffect(() => {
        if (!userId) return;
        if (applicationIds.length === 0) return;

        const applicationIdSet = new Set(applicationIds);

        const channel = supabase
            .channel(`application_messages:${userId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "application_messages" },
                (payload) => {
                    const row = payload.new as ApplicationMessageInsertRow;
                    if (!row || !applicationIdSet.has(row.application_id)) return;

                    appendMessage({
                        id: row.id,
                        application_id: row.application_id,
                        sender_id: row.sender_id,
                        body: row.body,
                        created_at: row.created_at,
                        sender_name: null,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [appendMessage, applicationIds, userId]);

    const fetchMyApplication = useCallback(
        async (uid: string, emailFallback: string, phoneFallback: string): Promise<Application | null> => {
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
            setContactEmail(appRow.contact_email ?? emailFallback);
            setContactPhone(appRow.contact_phone ?? phoneFallback);
            setContactTouched(false);
            fetchMessages(appRow.id);
            return appRow;
        } else {
            setMyApplication(null);
            setApplyMsg("");
            setContactEmail(emailFallback);
            setContactPhone(phoneFallback);
            setContactTouched(false);
            return null;
        }
        },
        [fetchMessages, gigId]
    );

    useEffect(() => {
        (async () => {
            setMsg(null);

            if (!Number.isFinite(gigId)) {
                setMsg("Ogiltigt gig-id.");
                return;
            }

            const { data } = await supabase.auth.getSession();
            const session = data.session ?? null;

            if (!session) {
                setUserId(null);
                setRole(null);
                setIsOwner(false);
                setApps([]);
                setMyApplication(null);
                setMessages({});
                setMessageInputs({});
                setMessageErrors({});
                setContactEmail("");
                setContactPhone("");
                setApplyMsg("");
                setContactTouched(false);

                const { data: g, error: gErr } = await supabase
                    .from("gigs")
                    .select("*")
                    .eq("id", gigId)
                    .single();

                if (gErr) return setMsg(gErr.message);
                setGig(g as Gig);
                return;
            }

            setUserId(session.user.id);

            const [{ data: profile, error: pErr }, { data: g, error: gErr }] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("role, contact_email, contact_phone")
                    .eq("id", session.user.id)
                    .maybeSingle(),
                supabase
                    .from("gigs")
                    .select("*")
                    .eq("id", gigId)
                    .single(),
            ]);

            if (pErr) {
                setMsg(pErr.message);
                return;
            }

            if (!profile) {
                router.replace("/onboarding");
                return;
            }

            if (gErr) return setMsg(gErr.message);

            const roleVal = profile.role as "musician" | "venue";
            const profileEmailFallback = profile.contact_email ?? "";
            const profilePhoneFallback = profile.contact_phone ?? "";
            setRole(roleVal);
            setContactEmail(profileEmailFallback);
            setContactPhone(profilePhoneFallback);
            setContactTouched(false);

            const gigRow = g as Gig;
            setGig(gigRow);

            const owner = roleVal === "venue" && gigRow.venue_id === session.user.id;
            setIsOwner(owner);

            if (owner) {
                const { data: a, error: aErr } = await supabase
                    .from("applications")
                    .select(
                        "id,message,status,created_at,musician_id,contact_email,contact_phone"
                    )
                    .eq("gig_id", gigId)
                    .order("created_at", { ascending: false });

                if (aErr) {
                    setMsg(aErr.message);
                } else {
                    const applicationRows = (a ?? []) as unknown as ApplicationRow[];
                    const baseMapped =
                        applicationRows.map((row) => ({
                            id: row.id,
                            message: row.message,
                            status: row.status,
                            created_at: row.created_at,
                            musician_id: row.musician_id,
                            contact_email: row.contact_email ?? null,
                            contact_phone: row.contact_phone ?? null,
                            musician_name: null,
                        })) ?? [];

                    const musicianIds = Array.from(
                        new Set(baseMapped.map((row) => row.musician_id))
                    );

                    let mapped = baseMapped;
                    if (musicianIds.length > 0) {
                        const { data: profileRows } = await supabase
                            .from("profiles")
                            .select("id, display_name")
                            .in("id", musicianIds);

                        if (profileRows) {
                            const profileMap = new Map(
                                profileRows.map((profile) => [profile.id, profile.display_name ?? null])
                            );
                            mapped = baseMapped.map((row) => ({
                                ...row,
                                musician_name: profileMap.get(row.musician_id) ?? null,
                            }));
                        }
                    }

                    setApps(mapped);
                    // Load messages for each application
                    mapped.forEach((appRow) => fetchMessages(appRow.id));
                }
            }

            if (!owner && roleVal === "musician") {
                await fetchMyApplication(session.user.id, profileEmailFallback, profilePhoneFallback);
            }
        })();
    }, [fetchMessages, fetchMyApplication, router, gigId]);

    useEffect(() => {
        if (role !== "musician") return;

        const handler = (event: Event) => {
            if (contactTouched) return;
            const detail = (event as CustomEvent).detail ?? {};
            const nextEmail = typeof detail.contact_email === "string" ? detail.contact_email : "";
            const nextPhone = typeof detail.contact_phone === "string" ? detail.contact_phone : "";
            setContactEmail(nextEmail);
            setContactPhone(nextPhone);
            setContactTouched(false);
        };

        window.addEventListener("musikmatch-contact-updated", handler as EventListener);
        return () => {
            window.removeEventListener("musikmatch-contact-updated", handler as EventListener);
        };
    }, [contactTouched, role]);

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

        const { data: inserted, error } = await supabase
            .from("application_messages")
            .insert({ application_id: applicationId, sender_id: session.user.id, body: trimmed })
            .select("id,application_id,sender_id,body,created_at")
            .single();

        if (error) {
            setMessageErrors((prev) => ({ ...prev, [applicationId]: error.message }));
            return;
        }

        if (inserted) {
            const row = inserted as ApplicationMessageInsertRow;
            appendMessage({
                id: row.id,
                application_id: row.application_id,
                sender_id: row.sender_id,
                body: row.body,
                created_at: row.created_at,
                sender_name: null,
            });
        }

        setMessageInputs((prev) => ({ ...prev, [applicationId]: "" }));
        setMessageErrors((prev) => ({ ...prev, [applicationId]: null }));
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
            setContactTouched(false);
            fetchMessages(updatedApp.id);
            setMsg("Ansökan uppdaterad.");
        } else {
            const insertPayload: {
                gig_id: number;
                musician_id: string;
                message: string | null;
                contact_email: string | null;
                contact_phone: string | null;
            } = {
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
            setContactTouched(false);
            fetchMessages(insertedApp.id);
            setMsg("Ansökan skickad.");
        }
    }

    async function setStatus(appId: number, status: "accepted" | "rejected") {
        setMsg(null);
        if (!isOwner) return setMsg("Du kan bara ändra status på dina egna gigs.");

        const { error } = await supabase.rpc("set_application_status", {
            p_application_id: appId,
            p_status: status,
        });

        if (error) return setMsg(error.message);

        setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    }

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-300/70 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-300/50";

    const backHref = searchParams?.get("from") === "my-applications" ? "/my-applications" : "/gigs";
    const backLabel = searchParams?.get("from") === "my-applications" ? "← Tillbaka till mina ansökningar" : "← Tillbaka till gigs";

    const formatGigTiming = (startIso: string, durationMinutes: number) => {
        const startDate = new Date(startIso);
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        return `${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
    };

    const redirectToLogin = () => {
        router.replace("/login");
    };

    const handleMessageKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
        applicationId: number
    ) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        sendMessage(applicationId, messageInputs[applicationId] ?? "");
    };

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
                            {gig.image_url ? (
                                <img
                                    src={gig.image_url}
                                    alt={`Bild för ${gig.title}`}
                                    className="mb-4 h-auto w-full rounded-xl border border-white/10"
                                />
                            ) : null}
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.15em] text-emerald-200/80">Gig</p>
                                    <h1 className="text-2xl font-semibold text-white">{gig.title}</h1>
                                    <p className="mt-2 text-sm text-slate-200/80">
                                        {gig.city ?? "—"} · {formatGigTiming(gig.start_time, gig.duration_minutes)} ·{" "}
                                        {gig.duration_minutes} min
                                    </p>
                                </div>
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/90">
                                    #{gig.id}
                                </span>
                            </div>

                            {gig.budget_min != null || gig.budget_max != null ? (
                                <p className="mt-4 text-sm text-slate-200/80">
                                    Budget: {gig.budget_min ?? "?"}–{gig.budget_max ?? "?"} kr/timme
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
                                                onChange={(e) => {
                                                    setContactTouched(true);
                                                    setContactEmail(e.target.value);
                                                }}
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
                                                onChange={(e) => {
                                                    setContactTouched(true);
                                                    setContactPhone(e.target.value);
                                                }}
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
                                                    onKeyDown={(event) => handleMessageKeyDown(event, myApplication.id)}
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
                            ) : userId == null ? (
                                <section className="mt-6 space-y-3">
                                    <h2 className="text-lg font-semibold text-white">Ansök</h2>
                                    <p className="text-sm text-slate-200/80">
                                        Logga in för att skicka ansökan och chatta med venue.
                                    </p>
                                    <textarea
                                        className={`${inputClass} min-h-[120px] opacity-70`}
                                        placeholder="Meddelande (valfritt)"
                                        value=""
                                        readOnly
                                    />
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/60">
                                                Kontaktmail (delas vid accept)
                                            </p>
                                            <input
                                                className={`${inputClass} opacity-70`}
                                                placeholder="din@mail.se"
                                                value=""
                                                readOnly
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/60">
                                                Telefon (delas vid accept)
                                            </p>
                                            <input
                                                className={`${inputClass} opacity-70`}
                                                placeholder="+46..."
                                                value=""
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={redirectToLogin}
                                        className="inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                                    >
                                        Logga in för att ansöka
                                    </button>
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
                                                            onKeyDown={(event) => handleMessageKeyDown(event, a.id)}
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
