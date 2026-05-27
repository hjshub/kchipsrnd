/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/html/**/*.html',
    './src/js/**/*.js',
  ],
  safelist: [
    'text-left',
    'text-center',
    'text-right',
    'text-justify',
    { pattern: /^(m|p)(x|y|t|r|b|l)?-(0|1|2|3|4|5|6|7|8|9|10)$/ },
    {
      pattern: /^text-(left|center|right|justify)$/,
      variants: ['sm', 'md', 'lg'],
    },
    {
      pattern: /^(m|p)(x|y|t|r|b|l)?-(0|1|2|3|4|5|6|7|8|9|10)$/,
      variants: ['sm', 'md', 'lg'],
    },
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
    },
    extend: {},
  },
  plugins: [],
  corePlugins: { preflight: true }
};
