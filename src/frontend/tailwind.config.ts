import type { Config } from "tailwindcss";
import { Config as PostCSSConfig } from '@tailwindcss/postcss';

const config: Config & { postcss?: PostCSSConfig } = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};

export default config;
