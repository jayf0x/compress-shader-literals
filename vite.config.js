import { snapBuild } from 'byte-snap';
import { resolve } from 'path';
import include from 'plugin-include';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [snapBuild.vite({ dir: 'dist' }), include('./README.md')],
  build: {
    minify: 'oxc',
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        '@babel/parser',
        '@babel/traverse',
        '@rollup/pluginutils',
        '@shaderfrog/glsl-parser',
        'byte-snap',
        'magic-string',
        'unplugin',
        /^wgsl_reflect/,
        /^node:/,
      ],
      output: {
        exports: 'named',
      },
    },
  },
});
