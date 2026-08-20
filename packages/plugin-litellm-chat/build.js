const esbuild = require('esbuild');

async function build() {
  const shared = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    packages: 'external',
    sourcemap: true,
    loader: { '.ts': 'tsx', '.tsx': 'tsx' },
  };

  await Promise.all([
    esbuild.build({
      ...shared,
      outfile: 'dist/index.esm.js',
      format: 'esm',
    }),
    esbuild.build({
      ...shared,
      outfile: 'dist/index.cjs.js',
      format: 'cjs',
    }),
  ]);
  // eslint-disable-next-line no-console
  console.log('Build complete');
}

build().catch(() => process.exit(1));