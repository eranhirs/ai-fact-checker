import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to copy manifest and rename sidepanel html
function chromeExtensionPlugin(): Plugin {
  return {
    name: 'chrome-extension',
    writeBundle() {
      // Copy manifest.json
      fs.copyFileSync(
        path.resolve(__dirname, 'public/manifest.json'),
        path.resolve(__dirname, 'dist/manifest.json')
      );

      // Copy icons
      const iconsSource = path.resolve(__dirname, 'public/icons');
      const iconsDest = path.resolve(__dirname, 'dist/icons');
      if (fs.existsSync(iconsSource)) {
        if (!fs.existsSync(iconsDest)) {
          fs.mkdirSync(iconsDest, { recursive: true });
        }
        for (const file of fs.readdirSync(iconsSource)) {
          fs.copyFileSync(
            path.join(iconsSource, file),
            path.join(iconsDest, file)
          );
        }
      }

      // Rename sidepanel html if needed
      const srcHtml = path.resolve(__dirname, 'dist/src/sidepanel/index.html');
      const destHtml = path.resolve(__dirname, 'dist/sidepanel.html');
      if (fs.existsSync(srcHtml)) {
        let html = fs.readFileSync(srcHtml, 'utf-8');
        // Fix script and CSS paths
        html = html.replace(/src="[^"]*index\.tsx"/, 'src="./sidepanel.js"');
        html = html.replace(/src="\/sidepanel\.js"/, 'src="./sidepanel.js"');
        // Fix CSS path - Vite outputs it with a different name
        html = html.replace(/href="[^"]*\.css"/, 'href="./sidepanel.css"');
        fs.writeFileSync(destHtml, html);
        // Clean up nested directories
        fs.rmSync(path.resolve(__dirname, 'dist/src'), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, 'src/sidepanel/index.html'),
        background: path.resolve(__dirname, 'src/background.ts'),
        'content-script': path.resolve(__dirname, 'src/content-script.ts'),
        'generic-content-script': path.resolve(__dirname, 'src/generic-content-script.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
