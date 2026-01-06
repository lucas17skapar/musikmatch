"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

const ROLE_STORAGE_KEY = "musikmatch_role";
const THEME_STORAGE_KEY = "musikmatch_theme";

type AppShellProps = {
  children: ReactNode;
  containerClassName?: string;
};

export function AppShell({ children, containerClassName }: AppShellProps) {
  const [role, setRole] = useState<"musician" | "venue" | "unknown">("unknown");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    let active = true;

    async function loadRole(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      if (profile?.role === "musician" || profile?.role === "venue") {
        setRole(profile.role);
        if (typeof window !== "undefined") localStorage.setItem(ROLE_STORAGE_KEY, profile.role);
      } else {
        setRole("unknown");
        if (typeof window !== "undefined") localStorage.removeItem(ROLE_STORAGE_KEY);
      }
    }

    (async () => {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(ROLE_STORAGE_KEY);
        if (cached === "musician" || cached === "venue") setRole(cached);
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (active) {
          setRole("unknown");
          if (typeof window !== "undefined") localStorage.removeItem(ROLE_STORAGE_KEY);
        }
        return;
      }

      await loadRole(session.user.id);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        setRole("unknown");
        if (typeof window !== "undefined") localStorage.removeItem(ROLE_STORAGE_KEY);
        return;
      }
      loadRole(session.user.id);
    });

    const themeListener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === "light" || detail === "dark") {
        setTheme(detail);
      }
    };
    window.addEventListener("musikmatch-theme", themeListener as EventListener);

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
      window.removeEventListener("musikmatch-theme", themeListener as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
  }, [theme]);

  const containerClasses = [
    "relative z-10 mx-auto max-w-6xl px-6 py-10",
    containerClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const isLight = theme === "light";
  const wrapperClass = isLight
    ? "relative min-h-screen overflow-hidden bg-white text-slate-900"
    : "relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white";
  const headerClass = isLight
    ? "relative z-20 border-b border-slate-200 bg-white/90 backdrop-blur"
    : "relative z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur";
  const navBase = "rounded-full px-4 py-2 transition";
  const navClass = isLight ? `${navBase} text-slate-900 hover:bg-slate-100` : `${navBase} hover:bg-white/10`;

  return (
    <div className={wrapperClass}>
      {!isLight ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute -left-10 -bottom-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-[120px]" />
          <div className="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-indigo-400/10 blur-[90px]" />
        </div>
      ) : null}

      <header className={headerClass}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className={`text-lg font-semibold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}
          >
            Musikmatch
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Link className={navClass} href="/gigs">
              Gigs
            </Link>
            <Link
              className={`${
                role === "venue"
                  ? "rounded-full border border-emerald-300/60 px-4 py-2 text-emerald-100 hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-slate-950 hover:border-emerald-400"
                  : "hidden"
              }`}
              href="/musicians"
            >
              Musiker
            </Link>
            <Link
              className={`${
                role === "musician"
                  ? "rounded-full border border-emerald-300/60 px-4 py-2 text-emerald-100 hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-slate-950 hover:border-emerald-400"
                  : "hidden"
              }`}
              href="/my-applications"
            >
              Mina ansökningar
            </Link>
            <Link
              className={`${
                role === "musician"
                  ? "rounded-full border border-cyan-300/60 px-4 py-2 text-cyan-100 hover:-translate-y-0.5 hover:bg-cyan-300 hover:text-slate-950 hover:border-cyan-400"
                  : "hidden"
              }`}
              href="/venues"
            >
              Venues
            </Link>
            <Link
              className={`${
                role === "venue"
                  ? "rounded-full border border-emerald-300/60 px-4 py-2 text-emerald-100 hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-slate-950 hover:border-emerald-400"
                  : "hidden"
              }`}
              href="/my-gigs"
            >
              Mina gig
            </Link>
            <Link className={navClass} href="/dashboard">
              Profil
            </Link>
          </nav>
        </div>
      </header>

      <div className={containerClasses}>{children}</div>
    </div>
  );
}
