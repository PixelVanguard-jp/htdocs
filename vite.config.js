import { defineConfig } from 'vite';
import { terser } from 'rollup-plugin-terser'; // JS圧縮・難読化用
import htmlMinifier from 'rollup-plugin-html-minifier'; // HTML圧縮用
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  // 本番ビルド時は absolute URL、開発時は '/'
  const basePrefix = isProd ? 'https://pixelvanguard.jp/' : '/';

  return {
    root: 'src',
    base: basePrefix,
    publicDir: path.resolve(__dirname, 'public'), 
    
    server: {
      open: true, 
      port: 2222,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: '../dist', 
      minify: 'esbuild',
      assetsInlineLimit: 0, 
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/index.html'),
        },
        plugins: [
          terser(),
          htmlMinifier({
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
          }),
        ],
      },
    },
    css: {
      minify: true,
    }
  }
});