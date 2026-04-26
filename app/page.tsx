import Link from "next/link";

export default function SplashPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-10 relative overflow-hidden bg-derby">
      {/* Decorative roses */}
      <div className="pointer-events-none select-none absolute inset-0 opacity-[0.06] flex flex-wrap content-start gap-10 text-7xl overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i}>🌹</span>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10">
        {/* Logo + title */}
        <div className="text-center mb-12">
          <div className="text-7xl mb-3 drop-shadow-lg">🏇</div>
          <h1 className="font-serif text-5xl sm:text-6xl font-extrabold text-white tracking-tight leading-none">
            Furlong
            <span className="text-[var(--gold)]"> &amp; </span>
            Friends
          </h1>
          <div className="flex items-center justify-center gap-3 my-5">
            <div className="h-px w-12 bg-[var(--gold)]" />
            <span className="text-[var(--gold)] text-lg">🌹</span>
            <div className="h-px w-12 bg-[var(--gold)]" />
          </div>
          <p className="text-[var(--gold)] font-serif italic text-lg sm:text-xl max-w-xs">
            The Ultimate Derby Day Pick &lsquo;Em Game
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Link
            href="/join"
            className="flex items-center justify-center h-14 rounded-full bg-[var(--rose-dark)] text-white font-bold text-xl border-2 border-[var(--gold)]/60 shadow-lg hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
          >
            <span className="mr-2">🐎</span>
            Join Game
          </Link>
          <Link
            href="/track"
            className="flex items-center justify-center h-14 rounded-full bg-transparent text-[var(--gold)] font-bold text-xl border-2 border-[var(--gold)] hover:bg-[var(--gold)]/10 active:scale-[0.98] transition-all"
          >
            <span className="mr-2">🏁</span>
            Live Track
          </Link>
        </div>
      </div>

      {/* Admin link */}
      <div className="relative z-10">
        <Link
          href="/admin"
          className="text-white/30 text-sm hover:text-white/60 transition-colors"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}
