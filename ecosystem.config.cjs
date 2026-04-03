module.exports = {
  apps: [
    {
      name: 'renovation-estimate',
      script: 'server/index.mjs',
      interpreter: 'node',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 8787,
      },
    },
  ],
}
