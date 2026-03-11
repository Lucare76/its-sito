module.exports = {
  mode: 'jit',
  purge: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        nightBlue: '#1e3a8a',
        marbleWhite: '#f8fafc',
        lemonYellow: '#facc15',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
