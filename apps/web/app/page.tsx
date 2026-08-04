import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <p className="text-sm tracking-wide uppercase text-[#8A8D91] mb-2">
        Think Tank Solutions AI
      </p>
      <h1
        className="text-4xl font-semibold text-[#0A2540] mb-4"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        B.i.a.B Collab
      </h1>
      <p className="text-lg text-[#36454F] mb-8 max-w-xl">
        Intelligence, precisely applied. Results, rigorously measured. Real-time
        collaborative artifacts with Blake (TTSAI) on the canvas.
      </p>
      <Link
        href="/artifact/demo"
        className="inline-flex items-center rounded-lg bg-[#0A2540] text-white px-5 py-3 text-sm font-medium hover:bg-[#143A66] transition-colors"
      >
        Open demo artifact
      </Link>
    </main>
  );
}
