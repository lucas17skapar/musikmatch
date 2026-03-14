"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/app/AppShell";

type MusicianProfile = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  music_type?: string | null;
  rating?: number | null;
  bankid_verified?: boolean | null;
  show_in_musician_list?: boolean | null;
  created_at?: string | null;
};

type AcceptedGig = {
  id: number;
  title: string;
  city: string | null;
  start_time: string;
  duration_minutes: number;
  budget_min: number | null;
  budget_max: number | null;
};

type AcceptedApplicationRow = {
  gig_id: number;
  gigs?: AcceptedGig[];
};

type MusicianReviewRow = {
  id: number;
  musician_id: string;
  venue_id: string;
  gig_id: number | null;
  rating: number | string;
  comment: string | null;
  created_at: string;
};

type VenueName = {
  id: string;
  display_name: string | null;
};

type GigTitle = {
  id: number;
  title: string;
};

type MusicianReview = {
  id: number;
  venue_name: string | null;
  gig_title: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export default function MusicianProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const musicianId = useMemo(() => params.id, [params.id]);

  const [profile, setProfile] = useState<MusicianProfile | null>(null);
  const [acceptedGigs, setAcceptedGigs] = useState<AcceptedGig[]>([]);
  const [reviews, setReviews] = useState<MusicianReview[]>([]);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [historyMsg, setHistoryMsg] = useState<string | null>(null);
  const [reviewsMsg, setReviewsMsg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setMsg(null);
      setHistoryMsg(null);
      setReviewsMsg(null);
      setLoading(true);
      if (!musicianId || typeof musicianId !== "string") {
        if (active) setMsg("Ogiltigt musiker-id.");
        if (active) setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: viewerProfile, error: viewerError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (viewerError) {
        if (active) setMsg(viewerError.message);
        if (active) setLoading(false);
        return;
      }

      if (!viewerProfile) {
        router.replace("/onboarding");
        return;
      }

      if (viewerProfile.role !== "venue") {
        if (active) setMsg("Endast venues kan se musikerprofiler.");
        if (active) setLoading(false);
        return;
      }

      const { data: musicianProfile, error: musicianError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", musicianId)
        .maybeSingle();

      if (musicianError) {
        if (active) setMsg(musicianError.message);
        if (active) setLoading(false);
        return;
      }

      if (!musicianProfile || musicianProfile.role !== "musician") {
        if (active) setMsg("Musikern hittades inte.");
        if (active) setLoading(false);
        return;
      }

      if (musicianProfile.show_in_musician_list === false) {
        if (active) setMsg("Den här musikern är inte synlig i katalogen.");
        if (active) setLoading(false);
        return;
      }

      if (active) setProfile(musicianProfile as MusicianProfile);

      const { data: acceptedRows, error: acceptedError } = await supabase
        .from("applications")
        .select("gig_id,gigs(id,title,city,start_time,duration_minutes,budget_min,budget_max)")
        .eq("musician_id", musicianId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(25);

      if (acceptedError) {
        if (active) setHistoryMsg("Kunde inte läsa tidigare gigs just nu.");
      } else if (acceptedRows && active) {
        const uniqueByGigId = new Map<number, AcceptedGig>();
        (acceptedRows as AcceptedApplicationRow[]).forEach((row) => {
          const gig = row.gigs?.[0];
          if (!gig || uniqueByGigId.has(gig.id)) return;
          uniqueByGigId.set(gig.id, gig);
        });
        setAcceptedGigs(Array.from(uniqueByGigId.values()));
      }

      const { data: reviewRows, error: reviewError } = await supabase
        .from("musician_reviews")
        .select("id,musician_id,venue_id,gig_id,rating,comment,created_at")
        .eq("musician_id", musicianId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (reviewError) {
        if (isMissingTableError(reviewError)) {
          if (active) setReviewsEnabled(false);
        } else if (active) {
          setReviewsMsg("Kunde inte läsa recensioner just nu.");
        }
      } else if (reviewRows && active) {
        const rows = reviewRows as MusicianReviewRow[];
        const venueIds = Array.from(new Set(rows.map((row) => row.venue_id)));
        const gigIds = Array.from(
          new Set(
            rows
              .map((row) => row.gig_id)
              .filter((id): id is number => typeof id === "number")
          )
        );

        let venueNameMap = new Map<string, string | null>();
        let gigTitleMap = new Map<number, string | null>();

        if (venueIds.length > 0) {
          const { data: venueRows } = await supabase
            .from("profiles")
            .select("id,display_name")
            .in("id", venueIds);
          if (venueRows) {
            venueNameMap = new Map(
              (venueRows as VenueName[]).map((venue) => [venue.id, venue.display_name ?? null])
            );
          }
        }

        if (gigIds.length > 0) {
          const { data: gigRows } = await supabase
            .from("gigs")
            .select("id,title")
            .in("id", gigIds);
          if (gigRows) {
            gigTitleMap = new Map(
              (gigRows as GigTitle[]).map((gig) => [gig.id, gig.title])
            );
          }
        }

        setReviews(
          rows.map((row) => ({
            id: row.id,
            venue_name: venueNameMap.get(row.venue_id) ?? null,
            gig_title:
              typeof row.gig_id === "number" ? (gigTitleMap.get(row.gig_id) ?? null) : null,
            rating: Number(row.rating),
            comment: row.comment,
            created_at: row.created_at,
          }))
        );
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [musicianId, router]);

  return (
    <AppShell containerClassName="py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">Musikerprofil</p>
            <h1 className="text-2xl font-semibold text-white">
              {profile?.display_name ?? "Laddar..."}
            </h1>
          </div>
          <Link
            href="/musicians"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/70 hover:text-emerald-100"
          >
            ← Tillbaka till musiker
          </Link>
        </div>

        {msg && <p className="text-sm text-rose-100/90">{msg}</p>}
        {loading ? <p className="text-sm text-slate-200/80">Laddar...</p> : null}

        {!loading && !msg && profile ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30">
              <div className="flex flex-wrap items-center gap-2">
                {profile.music_type ? (
                  <span className="rounded-full border border-emerald-300/60 px-3 py-1 text-xs text-emerald-100">
                    {profile.music_type}
                  </span>
                ) : null}
                {typeof profile.rating === "number" ? (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100">
                    Betyg: {profile.rating.toFixed(1)}
                  </span>
                ) : null}
                {profile.bankid_verified ? (
                  <span className="rounded-full border border-emerald-300/70 px-3 py-1 text-xs text-emerald-100">
                    BankID-verifierad
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">Kontakt e-post</p>
                  <p className="mt-1 text-sm text-white">
                    {profile.contact_email ? (
                      <a className="hover:text-emerald-100" href={`mailto:${profile.contact_email}`}>
                        {profile.contact_email}
                      </a>
                    ) : (
                      "Inte angiven"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-200/70">Kontakt telefon</p>
                  <p className="mt-1 text-sm text-white">
                    {profile.contact_phone ? (
                      <a className="hover:text-emerald-100" href={`tel:${profile.contact_phone}`}>
                        {profile.contact_phone}
                      </a>
                    ) : (
                      "Inte angiven"
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30">
              <h2 className="text-lg font-semibold text-white">Tidigare gigs</h2>
              <p className="mt-1 text-sm text-slate-200/80">
                Tidigare accepterade gigs för den här musikern.
              </p>
              {historyMsg ? <p className="mt-3 text-sm text-rose-100/90">{historyMsg}</p> : null}
              {!historyMsg && acceptedGigs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-200/80">Inga tidigare gigs att visa ännu.</p>
              ) : null}
              <div className="mt-4 grid gap-3">
                {acceptedGigs.map((gig) => (
                  <Link
                    key={gig.id}
                    href={`/gigs/${gig.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-emerald-300/70 hover:text-emerald-100"
                  >
                    <p className="font-semibold">{gig.title}</p>
                    <p className="mt-1 text-xs text-slate-200/70">
                      {gig.city ?? "—"} · {new Date(gig.start_time).toLocaleString()} · {gig.duration_minutes} min
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30">
              <h2 className="text-lg font-semibold text-white">Recensioner</h2>
              {!reviewsEnabled ? (
                <p className="mt-2 text-sm text-slate-200/80">
                  Recensionsfunktionen är inte aktiverad i databasen ännu.
                </p>
              ) : null}
              {reviewsMsg ? <p className="mt-2 text-sm text-rose-100/90">{reviewsMsg}</p> : null}
              {reviewsEnabled && !reviewsMsg && reviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-200/80">Inga recensioner ännu.</p>
              ) : null}
              <div className="mt-4 grid gap-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {review.venue_name ?? "Venue"}
                        {review.gig_title ? ` · ${review.gig_title}` : ""}
                      </p>
                      <span className="rounded-full border border-emerald-300/70 px-2 py-1 text-xs text-emerald-100">
                        {review.rating.toFixed(1)} / 5
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm text-slate-200/85">{review.comment}</p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-200/60">Ingen kommentar.</p>
                    )}
                    <p className="mt-2 text-xs text-slate-300/70">
                      {new Date(review.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
