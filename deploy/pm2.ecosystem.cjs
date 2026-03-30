/**
 * PM2: npm i -g pm2
 *       pm2 start deploy/pm2.ecosystem.cjs
 *       pm2 save && pm2 startup
 */
const path = require('path');
const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'ttickett',
      cwd: root,
      script: path.join(root, 'node_modules/tsx/dist/cli.mjs'),
      args: 'server.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LISTEN_HOST: '0.0.0.0',
      },
    },
  ],
};
