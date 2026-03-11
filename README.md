# I.T.S. Ischia Transfer Service S.r.l.

Welcome to the I.T.S. Ischia Transfer Service S.r.l. project! This repository contains the source code for a modern single-page website designed for the Ischia Transfer Service, featuring a luxurious aesthetic inspired by the 'Ischia Luxury' color palette.

## Project Structure

```
its-ischia-transfer-service
├── src
│   ├── index.html          # Main HTML document for the website
│   ├── styles
│   │   └── tailwind.css    # Tailwind CSS styles
│   ├── scripts
│   │   └── main.js         # JavaScript for smooth scrolling and interactivity
│   └── assets
│       └── fonts
│           └── Montserrat.ttf # Montserrat font file
├── tailwind.config.js      # Tailwind CSS configuration
├── package.json            # npm configuration and dependencies
└── README.md               # Project documentation
```

## Color Palette

- **Night Blue**: #1e3a8a
- **Marble White**: #f8fafc
- **Lemon Yellow**: #facc15

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/its-ischia-transfer-service.git
   cd its-ischia-transfer-service
   ```

2. **Install dependencies**:
   Make sure you have Node.js installed, then run:
   ```bash
   npm install
   ```

3. **Build the project**:
   To generate the Tailwind CSS styles, run:
   ```bash
   npx tailwindcss -i ./src/styles/tailwind.css -o ./dist/styles.css --watch
   ```

4. **Open the website**:
   You can open `src/index.html` in your browser to view the website.

## Usage Guidelines

- The website features smooth scrolling navigation for a seamless user experience.
- The Montserrat font is used throughout the site for a modern and elegant look.
- Customize the content in `src/index.html` to fit your specific needs.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for details.