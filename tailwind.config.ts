import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './apps/web/app/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        foreground: '#f9fafb',
        primary: {
          DEFAULT: '#4f46e5',
          foreground: '#ffffff',
        },
        success: '#22c55e',
        danger: '#ef4444',
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
