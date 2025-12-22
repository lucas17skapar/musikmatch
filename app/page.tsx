"use client";

import Link from "next/link";
import { AppShell } from "@/app/AppShell";

export default function Home() {
  return (
    <AppShell containerClassName="flex flex-col gap-12">
      <main className="flex flex-col gap-12 py-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-100/80">
              Ny match för livemusik
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Hitta rätt musik för rätt scen, utan krångel.
            </h1>
            <p className="max-w-2xl text-lg text-slate-200/80">
              Musikmatch kopplar samman musiker och venues med tydliga gigbeskrivningar och snabb onboarding. Välj din väg nedan och kom igång direkt.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/gigs"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                Utforska gigs
              </Link>
              <Link
                href="/gigs/new"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:text-emerald-100"
              >
                Publicera ett gig
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-200/70">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Ingen annonstext? Vi guidar dig.
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Säkra datum och budget i förväg.
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Rollen styr upplevelsen.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/gigs"
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 px-6 py-6 shadow-2xl shadow-emerald-500/10 ring-1 ring-white/5 transition hover:-translate-y-1 hover:border-emerald-300/60 hover:ring-emerald-300/40"
            >
              <div className="absolute inset-0 bg-emerald-500/0 transition duration-300 group-hover:bg-emerald-500/5" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-emerald-200/80">Jag är musiker</p>
                  <h3 className="mt-2 text-2xl font-semibold">Hitta gig</h3>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Se öppna spelningar, filtrera på stad och budget och ansök direkt. Lägg till favoriter i din dashboard.
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-emerald-100/90">Sättlistor välkomna</span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-200 transition group-hover:gap-3">
                Börja leta
                <span aria-hidden className="transition transform group-hover:translate-x-1">
                  &gt;
                </span>
              </div>
            </Link>

            <Link
              href="/gigs/new"
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 px-6 py-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/5 transition hover:-translate-y-1 hover:border-cyan-300/60 hover:ring-cyan-300/40"
            >
              <div className="absolute inset-0 bg-cyan-500/0 transition duration-300 group-hover:bg-cyan-500/5" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-cyan-200/80">Jag är venue</p>
                  <h3 className="mt-2 text-2xl font-semibold">Skapa gig / mina gig</h3>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Publicera kommande datum, sätt budgetintervall och håll koll på inkommande intresse från musiker.
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-cyan-100/90">Snabb publicering</span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-cyan-200 transition group-hover:gap-3">
                Skapa gig
                <span aria-hidden className="transition transform group-hover:translate-x-1">
                  &gt;
                </span>
              </div>
            </Link>
          </div>
        </div>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-6 shadow-lg shadow-black/30 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Transparens</p>
            <p className="text-sm text-slate-200/80">
              Tydliga tider, budget och längd direkt i varje gig så att båda parter sparar tid.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Snabb start</p>
            <p className="text-sm text-slate-200/80">
              Skapa konto och välj roll på några sekunder, hoppa sedan till dashboarden.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Enkel navigation</p>
            <p className="text-sm text-slate-200/80">
              Genvägar till Gigs, Dashboard och utloggning finns alltid i toppbaren.
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
