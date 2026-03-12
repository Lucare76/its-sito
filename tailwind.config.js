module.exports = {
  mode: 'jit',
  purge: ['./*.html', './en/**/*.html', './scripts/**/*.js'],
  theme: {
    extend: {
      colors: {
        nightBlue: '#1e3a8a',
        marbleWhite: '#f8fafc',
        lemonYellow: '#facc15',
      },
      fontFamily: {
        montserrat: [
          'Montserrat',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
