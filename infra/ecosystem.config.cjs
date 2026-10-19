// PM2 processes on the VPS (SPEC §18.3): one API and one web process (1 vCPU), memory caps for a
// 4 GB server, environment from the shared env files (never in Git). Paths go through the
// `current` symlink, so `pm2 startOrReload` after a deploy starts the new release.
//
//   pm2 startOrReload /srv/aricon/current/infra/ecosystem.config.cjs --update-env

const ROOT = '/srv/aricon';

module.exports = {
  apps: [
    {
      name: 'aricon-api',
      cwd: `${ROOT}/current/api`,
      script: 'dist/main.js',
      node_args: [`--env-file=${ROOT}/shared/.env.api`, '--max-old-space-size=384'],
      env: { NODE_ENV: 'production' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '450M',
      // Agenda gets up to 15 s to finish a running job on SIGTERM (SPEC §13).
      kill_timeout: 20000,
      time: true,
    },
    {
      name: 'aricon-web',
      cwd: `${ROOT}/current/web/apps/web`,
      script: 'server.js',
      node_args: [`--env-file=${ROOT}/shared/.env.web`, '--max-old-space-size=512'],
      env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      kill_timeout: 10000,
      time: true,
    },
  ],
};
