import { babel } from '@rollup/plugin-babel';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'lib/index.js',
      name: 'kitsu',
      format: 'cjs'
    },
    {
      file: 'dist/bundle.min.js',
      format: 'iife',
      name: 'kitsu'
    }
  ],
  plugins: [babel({ babelHelpers: 'runtime' })]
};
