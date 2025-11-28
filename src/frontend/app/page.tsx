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
      <section id="how-it-works" className="py-24 px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">The Three-Chart System</h2>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Reality Chart */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl mb-6">
                🌍
              </div>
              <h3 className="text-xl font-semibold mb-3">Reality Chart</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Driven by AI analysis of real-world data sources. It represents the objective "truth" of an event's probability or value.
              </p>
            </div>

            {/* Market Chart */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-2xl mb-6">
                📊
              </div>
              <h3 className="text-xl font-semibold mb-3">Market Chart</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Driven by user supply and demand in the orderbook. It reflects the crowd's sentiment and speculation.
              </p>
            </div>

            {/* Trading Chart */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-2xl mb-6">
                📈
              </div>
              <h3 className="text-xl font-semibold mb-3">Trading Chart</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                The blended price where trades actually execute. It converges Reality and Market values to ensure fair pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Explore Markets</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {(Object.entries(MARKET_TYPE_INFO) as [MarketType, typeof MARKET_TYPE_INFO[MarketType]][]).map(([type, info]) => (
              <Link
                key={type}
                href={`/discover?type=${type}`}
                className="group p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-md bg-white dark:bg-zinc-900"
              >
                <div className="text-3xl mb-4 group-transform group-hover:scale-110 transition-transform duration-300">
                  {info.icon}
                </div>
                <h3 className="font-semibold text-lg mb-1">{info.label}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{info.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
