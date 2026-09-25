import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config = defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          // Keep the database workspace boundary explicit regardless of install layout.
          external: (id) =>
            id === '@postlude/db' || id.startsWith('@postlude/db/'),
        },
      },
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
