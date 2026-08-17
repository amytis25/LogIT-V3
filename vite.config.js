// vite.config.js
// Description: builds the single renderer bundle (all window kinds share it; the
//              window kind arrives via query param). Output is loaded over file://
//              inside Electron, hence the relative base.
// Inputs:  src/renderer/ source tree
// Outputs: dist/ (index.html + assets)
// Created: 2026-08-17

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  }
});
