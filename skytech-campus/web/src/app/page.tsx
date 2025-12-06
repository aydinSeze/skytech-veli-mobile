import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-white tracking-tight">
            SkyTech Campus
          </h1>
          <p className="text-xl text-slate-400">
            Okul Kantin Yönetiminin Geleceği
          </p>
        </div>

        <Link href="/dashboard" className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-indigo-500/25">
          Yönetim Paneline Giriş
          <span className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
        </Link>
      </div>
    </main>
  );
}
