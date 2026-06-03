import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8f5f0',
          100: '#ede4d8',
          200: '#d9c9b0',
          300: '#c0a880',
          400: '#a88855',
          500: '#8b6f3a',
          600: '#6d5228',
          700: '#4f3a1a',
          800: '#33260f',
          900: '#1a1307',
          950: '#0d0a03',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
