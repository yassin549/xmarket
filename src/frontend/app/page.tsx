import Link from 'next/link';
import { MARKET_TYPE_INFO, MarketType } from '@/types/market';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-32 lg:px-8 flex flex-col items-center text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),white)] dark:bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.900),theme(colors.zinc.950))] opacity-20" />

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 mb-6">
          Trade on Reality
        </h1>
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mb-10">
          The first platform where market prices are driven by real-world data.
          Analyze, predict, and trade on political, economic, and social events using our unique Three-Chart System.
        </p>

        <div className="flex gap-4">
          <Link
            href="/discover"
            className="rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all"
          >
            Start Trading
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full px-8 py-3.5 text-sm font-semibold text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
          >
            How it Works
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[var(--bg-05)]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Xmarket?</h2>
            <p className="text-[var(--muted-20)] max-w-xl mx-auto">
              Built for sophisticated traders who want exposure to the real world.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Real-World Assets",
                description: "Trade directly on political polls, economic data, and global events.",
                icon: "🌍"
              },
              {
                title: "Three-Chart System",
                description: "Advanced visualization tools to analyze trends and make informed decisions.",
                icon: "📊"
              },
              {
                title: "Instant Settlement",
                description: "Lightning fast execution and settlement on our high-performance engine.",
                icon: "⚡"
              }
            ].map((feature, i) => (
              <div key={i} className="card group hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-[var(--surface-20)] rounded-lg flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-[var(--muted-30)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
