import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] text-white px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 text-8xl font-bold font-mono text-[#f5841f]">404</div>
        <h1 className="text-2xl font-bold mb-3">Telemetry Lost</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Signal lost on this channel. The page you&apos;re looking for has no data in the telemetry feed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#f5841f] px-6 py-3 font-semibold text-black hover:bg-[#f5841f]/80 transition-colors"
        >
          ← Back to Intelligence Hub
        </Link>
      </div>
    </div>
  );
}
