import { defineConfig } from 'vite';
import { terser } from 'rollup-plugin-terser'; // JS圧縮・難読化用
import htmlMinifier from 'rollup-plugin-html-minifier'; // HTML圧縮用

export default defineConfig(({ mode }) => {
  return {
    root: 'src',
    base: '',
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
      outDir: '../public',
      minify: 'esbuild',
      rollupOptions: {
        input: {
          main: 'src/index.html',
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
