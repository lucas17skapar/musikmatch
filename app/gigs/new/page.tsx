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
    const [endTime, setEndTime] = useState(""); // datetime-local
    const [budgetMin, setBudgetMin] = useState<number | "">("");
    const [budgetMax, setBudgetMax] = useState<number | "">("");
    const [msg, setMsg] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const maxImageBytes = 5 * 1024 * 1024;

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

    useEffect(() => {
        if (!imageFile) {
            setImagePreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(imageFile);
        setImagePreview(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [imageFile]);

    async function createGig() {
        setMsg(null);
        if (saving) return;
        setSaving(true);

        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
            setSaving(false);
            return router.replace("/login");
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

        if (!profile || profile.role !== "venue") {
            setSaving(false);
            return setMsg("Endast venue kan skapa gigs.");
        }

        if (title.trim().length < 3) {
            setSaving(false);
            return setMsg("Titel måste vara minst 3 tecken.");
        }
        if (!startTime) {
            setSaving(false);
            return setMsg("Välj starttid.");
        }
        if (!endTime) {
            setSaving(false);
            return setMsg("Välj sluttid.");
        }

        const start = new Date(startTime).toISOString();
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);

        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            setSaving(false);
            return setMsg("Sluttiden måste vara efter starttiden.");
        }
        if (durationMinutes < 15) {
            setSaving(false);
            return setMsg("Giget måste vara minst 15 minuter.");
        }

        let imageUrl: string | null = null;
        let uploadedPath: string | null = null;

        if (imageFile) {
            const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
            const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
            const unique =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const path = `gigs/${session.user.id}/${unique}.${safeExt}`;
            uploadedPath = path;

            const { error: uploadError } = await supabase.storage
                .from("gig-images")
                .upload(path, imageFile, {
                    cacheControl: "3600",
                    contentType: imageFile.type || "image/*",
                    upsert: false,
                });

            if (uploadError) {
                setSaving(false);
                return setMsg(`Kunde inte ladda upp bilden: ${uploadError.message}`);
            }

            const { data: publicUrl } = supabase.storage
                .from("gig-images")
                .getPublicUrl(path);
            imageUrl = publicUrl?.publicUrl ?? null;
        }

        const { data: inserted, error } = await supabase
            .from("gigs")
            .insert({
                venue_id: session.user.id,
                title: title.trim(),
                description: description.trim() || null,
                city: city.trim() || null,
                start_time: start,
                duration_minutes: durationMinutes,
                budget_min: budgetMin === "" ? null : budgetMin,
                budget_max: budgetMax === "" ? null : budgetMax,
                image_url: imageUrl,
            })
            .select("id")
            .single();

        if (error) {
            if (uploadedPath) {
                await supabase.storage.from("gig-images").remove([uploadedPath]);
            }
            setSaving(false);
            return setMsg(error.message);
        }

        setSaving(false);
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
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/60">
                                Gigbild (valfritt)
                            </p>
                            <input
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    if (!file) {
                                        setImageFile(null);
                                        return;
                                    }
                                    if (!file.type.startsWith("image/")) {
                                        setMsg("Filen måste vara en bild.");
                                        setImageFile(null);
                                        e.currentTarget.value = "";
                                        return;
                                    }
                                    if (file.size > maxImageBytes) {
                                        setMsg("Bilden är för stor (max 5 MB).");
                                        setImageFile(null);
                                        e.currentTarget.value = "";
                                        return;
                                    }
                                    setMsg(null);
                                    setImageFile(file);
                                }}
                            />
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt="Förhandsvisning av gigbild"
                                    className="h-40 w-full rounded-xl border border-white/10 object-cover"
                                />
                            ) : (
                                <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-slate-200/70">
                                    Ingen bild vald
                                </div>
                            )}
                        </div>
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
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-slate-200/70">
                            Ange start- och sluttid för giget (minst 15 min).
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <input
                                className={inputClass}
                                type="number"
                                placeholder="Budget min (kr/timme)"
                                value={budgetMin}
                                onChange={(e) => setBudgetMin(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <input
                                className={inputClass}
                                type="number"
                                placeholder="Budget max (kr/timme)"
                                value={budgetMax}
                                onChange={(e) => setBudgetMax(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                        </div>
                        <p className="text-xs text-slate-200/70">Prisintervallet är per timme.</p>

                        <button
                            onClick={createGig}
                            disabled={saving}
                            className="inline-flex justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                        >
                            {saving ? "Skapar..." : "Skapa"}
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
