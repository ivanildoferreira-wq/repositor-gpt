import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Ajustar para o nome do repositório ao publicar no GitHub Pages.
  base: '/repositorio-gpt/',
});