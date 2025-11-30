import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--bg-05)",
                surface: "var(--surface-10)",
                primary: {
                    DEFAULT: "var(--primary-50)",
                    hover: "var(--primary-60)",
                },
                accent: "var(--accent-50)",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                display: ["var(--font-outfit)", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
        },
        keyframes: {
            scroll: {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-50%)' },
            },
        },
        animation: {
            scroll: 'scroll 30s linear infinite',
        },
    },
    plugins: [],
};

export default config;
