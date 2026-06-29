module.exports = {
  apps: [
    {
      name: 'techsupport_okjt',
      script: './dist/app.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};