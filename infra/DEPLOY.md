# Deploying Aricon Portal

Production runs on one Hostinger KVM 1 (1 vCPU, 4 GB RAM, Ubuntu 24.04 LTS) behind Cloudflare
(SPEC §18). GitHub Actions builds and tests everything; the server never builds.

```text
Browser ─▶ Cloudflare ─▶ Nginx :443 ─┬─ /api/*      ─▶ aricon-api  (NestJS, 127.0.0.1:4000) ─▶ MongoDB rs0 (127.0.0.1:27017)
                                     ├─ /_internal/ ─▶ 404 (revalidation is server-to-server only)
                                     └─ /*          ─▶ aricon-web  (Next.js standalone, 127.0.0.1:3000)
Images:  https://images.aricon.com.pk ─▶ R2 bucket aricon-public (custom domain)
Receipts, backups: R2 bucket aricon-private (10-minute signed links only)
```

| File | Goes to | What |
| --- | --- | --- |
| `infra/nginx/shop.aricon.com.pk.conf` | `/etc/nginx/sites-available/` | reverse proxy, Cloudflare real IPs, gzip, static cache |
| `infra/mongod.conf` | `/etc/mongod.conf` | replica set `rs0`, localhost only, auth + keyfile, 1 GB cache |
| `infra/ecosystem.config.cjs` | shipped in every release | PM2: `aricon-api`, `aricon-web` |
| `infra/scripts/activate-release.sh` | shipped in every release | switch release, health check, roll back, keep 5 |
| `infra/backup/backup-mongo.sh` | shipped; linked from `/srv/aricon/scripts/` | nightly mongodump → R2, 30-day retention |
| `.github/workflows/ci.yml` / `deploy.yml` | GitHub | checks on every push / deploy on push to `main` |

> **Repository layout.** GitHub only runs workflows from `.github/workflows` at the **repository
> root**. They are written for a repository whose root is this `portal` folder (CLAUDE.md §5). If the
> portal stays inside a bigger repository, move `.github/` to that root and add
> `defaults: { run: { working-directory: <path to portal> } }` to each job (plus the same prefix on
> the `cache-dependency-path` / `hashFiles` paths).

Placeholders below: `<VPS_IP>`, `deploy` (the deploy user). Never put a real secret in Git, in a
GitHub issue or in chat — only in the server files and GitHub secrets named here.

---

## 1. Server basics (once, as root)

```bash
# Deploy user with SSH key login
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
passwd deploy                                   # sudo password; SSH stays key-only
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/    # or paste your public key
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
```

Check you can log in as `deploy` in a **second** terminal before continuing.

```bash
# No root login, no passwords
cat > /etc/ssh/sshd_config.d/00-aricon.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
systemctl restart ssh

# Updates, base packages, automatic security updates
apt update && apt full-upgrade -y
apt install -y ufw unattended-upgrades nginx rclone curl gnupg
dpkg-reconfigure -plow unattended-upgrades

# Server clock stays UTC (the app converts to Asia/Karachi itself; cron times below assume UTC)
timedatectl set-timezone UTC

# 2 GB swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf && sysctl --system

# Firewall: SSH from anywhere (GitHub Actions has no fixed IPs), web only from Cloudflare
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH
for range in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from "$range" to any port 80,443
done
ufw enable
```

## 2. Node.js 24, pnpm, PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
corepack enable pnpm            # not used by deploys (the server never installs or builds)
npm install -g pm2
```

As `deploy`:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 10
pm2 startup systemd -u deploy --hp /home/deploy   # prints one sudo command: run it
```

## 3. MongoDB (single-node replica set with access control)

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-8.0.list
apt update && apt install -y mongodb-org         # includes mongosh and mongodump/mongorestore

# Keyfile (required by a replica set with authorization, even with one member)
openssl rand -base64 756 > /etc/mongod-keyfile
chown mongodb:mongodb /etc/mongod-keyfile && chmod 400 /etc/mongod-keyfile

# From your computer first: scp infra/mongod.conf infra/nginx/shop.aricon.com.pk.conf deploy@<VPS_IP>:/tmp/
cp /tmp/mongod.conf /etc/mongod.conf
systemctl enable --now mongod
```

Initiate the replica set and create users. Until the first user exists, MongoDB allows this from
localhost only ("localhost exception"). Use long random passwords made of letters and digits only
(`openssl rand -hex 24`) so they need no escaping in connection strings; keep them in your password
manager.

```bash
mongosh --quiet --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
sleep 5
mongosh --quiet admin --eval 'db.createUser({ user: "admin", pwd: passwordPrompt(), roles: ["root"] })'
mongosh -u admin -p --authenticationDatabase admin     # asks for the admin password
```

In that mongosh session (each `passwordPrompt()` asks for the new user's password):

```js
db.getSiblingDB("aricon").createUser({ user: "aricon_app", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "aricon" }] })
db.getSiblingDB("admin").createUser({ user: "aricon_backup", pwd: passwordPrompt(), roles: ["backup"] })
exit
```

- `admin` (root): maintenance and restores only — never in an app config.
- `aricon_app`: the API (`readWrite` on `aricon` only).
- `aricon_backup`: mongodump only.

## 4. Folders

```bash
sudo mkdir -p /srv/aricon/{releases,shared,scripts} /var/log/aricon /var/backups/aricon
sudo chown -R deploy:deploy /srv/aricon /var/log/aricon /var/backups/aricon
```

```text
/srv/aricon/releases/{timestamp}/{api,web,infra}   uploaded by deploy.yml
/srv/aricon/current  →  releases/{timestamp}       switched by activate-release.sh
/srv/aricon/shared/.env.api, .env.web              settings (mode 600, never in Git)
/srv/aricon/scripts/backup-mongo.sh                → current/infra/backup/backup-mongo.sh
```

## 5. Environment files (as `deploy`, mode 600)

Generate each secret separately: `openssl rand -base64 48`.

`/srv/aricon/shared/.env.api` — every variable is described in `apps/api/.env.example`; the API
refuses to start in production with example secrets, local storage, no SMTP or http `APP_URL`.

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
LOG_LEVEL=info
API_DOCS_ENABLED=false
RATE_LIMIT_ENABLED=true
MONGODB_URI=mongodb://aricon_app:<password>@127.0.0.1:27017/aricon?replicaSet=rs0&authSource=aricon
JWT_CUSTOMER_SECRET=<secret 1>
JWT_ADMIN_SECRET=<secret 2, different>
APP_URL=https://shop.aricon.com.pk
RFP_CORS_ORIGINS=https://aricon.com.pk,https://www.aricon.com.pk
WEB_INTERNAL_URL=http://127.0.0.1:3000
REVALIDATE_SECRET=<secret 3, same value in .env.web>
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<Cloudflare account id>
R2_ACCESS_KEY_ID=<app token key id>
R2_SECRET_ACCESS_KEY=<app token secret>
R2_PUBLIC_BUCKET=aricon-public
R2_PRIVATE_BUCKET=aricon-private
PUBLIC_IMAGE_BASE_URL=https://images.aricon.com.pk
SMTP_HOST=<smtp host>
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
MAIL_FROM="Aricon Shop <no-reply@aricon.com.pk>"
```

`/srv/aricon/shared/.env.web`:

```dotenv
INTERNAL_API_URL=http://127.0.0.1:4000
REVALIDATE_SECRET=<secret 3>
NEXT_PUBLIC_SITE_URL=https://shop.aricon.com.pk
NEXT_PUBLIC_IMAGE_BASE_URL=https://images.aricon.com.pk
```

```bash
chmod 600 /srv/aricon/shared/.env.*
```

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so they must also be set as
GitHub repository variables (step 9). Changing them needs a new deploy, not just a restart.

## 6. Cloudflare

1. DNS: `A shop → <VPS_IP>`, **proxied** (orange cloud).
2. SSL/TLS → mode **Full (strict)**; Edge certificates → **Always Use HTTPS** on.
3. SSL/TLS → Origin Server → **Create certificate** (RSA, host `shop.aricon.com.pk`, 15 years). On the server:

   ```bash
   sudo install -d -m 755 /etc/ssl/cloudflare
   sudo nano /etc/ssl/cloudflare/shop.aricon.com.pk.pem   # paste the certificate
   sudo nano /etc/ssl/cloudflare/shop.aricon.com.pk.key   # paste the private key
   sudo chmod 600 /etc/ssl/cloudflare/shop.aricon.com.pk.key
   ```

4. Turn **off** Rocket Loader and Email Address Obfuscation (Scrape Shield). Both inject scripts
   that the site's Content-Security-Policy (per-request nonce) blocks — obfuscated emails would show
   as "[email protected]".

## 7. Cloudflare R2

1. Create buckets `aricon-public` and `aricon-private` (location hint: Asia-Pacific).
2. `aricon-public` → Settings → **Custom domain** `images.aricon.com.pk` (public, cached by
   Cloudflare). `aricon-private` stays private (no public access, no r2.dev URL).
3. R2 → Manage API tokens:
   - **App token**: Object Read & Write on both buckets → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in `.env.api`.
   - **Backup token**: Object Read & Write on `aricon-private` only → `backup.env` (step 11).

## 8. Nginx

```bash
sudo cp /tmp/shop.aricon.com.pk.conf /etc/nginx/sites-available/   # copied over in step 3
sudo ln -sfn /etc/nginx/sites-available/shop.aricon.com.pk.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

The Cloudflare IP ranges are listed in the config (`set_real_ip_from`) and in UFW; if
<https://www.cloudflare.com/ips/> changes, update both.

## 9. GitHub

On your computer, create the deploy key (no passphrase) and authorise it on the server:

```bash
ssh-keygen -t ed25519 -N "" -C "github-deploy" -f aricon-deploy
ssh deploy@<VPS_IP> 'cat >> ~/.ssh/authorized_keys' < aricon-deploy.pub
ssh-keyscan -t ed25519 <VPS_IP>          # output → SSH_KNOWN_HOSTS
```

Repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `SSH_HOST` | `<VPS_IP>` |
| Secret | `SSH_USER` | `deploy` |
| Secret | `SSH_KEY` | contents of `aricon-deploy` (private key) — then delete the local file |
| Secret | `SSH_KNOWN_HOSTS` | `ssh-keyscan` output |
| Variable | `NEXT_PUBLIC_SITE_URL` | `https://shop.aricon.com.pk` |
| Variable | `NEXT_PUBLIC_IMAGE_BASE_URL` | `https://images.aricon.com.pk` |

Optionally protect the `production` environment (Settings → Environments) with required reviewers.

## 10. First deploy

Push to `main` (or Actions → Deploy → Run workflow). The workflow:

1. runs CI (typecheck, lint, unit tests, API tests on a MongoDB replica set, build);
2. builds on ubuntu-24.04 x64, packages `api/` (`pnpm deploy --legacy --prod`: compiled code with
   production `node_modules`, sharp binaries for Linux), `web/` (Next.js standalone + `.next/static`
   + `public`) and `infra/`;
3. rsyncs it to `/srv/aricon/releases/<UTC timestamp>/`;
4. runs `infra/scripts/activate-release.sh`: links the env files, switches `current`,
   `pm2 startOrReload`, checks `https://shop.aricon.com.pk/api/health` and the web process
   (10 tries, 3 s apart), rolls back to the previous release on failure, `pm2 save`, keeps 5 releases.

Then create the first admin (never run `seed:demo` in production):

```bash
cd /srv/aricon/current/api
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD     # type the password, nothing is echoed
NODE_ENV=production node --env-file=/srv/aricon/shared/.env.api dist/scripts/seed-admin.js \
  --email admin@aricon.com.pk --name "Aricon Admin"
unset ADMIN_PASSWORD
```

Sign in at `https://shop.aricon.com.pk/admin/login`, then fill in Settings (store details, bank
accounts, payment methods), delivery areas, categories, brands and products.

### Everyday operations

```bash
pm2 status                       # both processes online?
pm2 logs aricon-api --lines 100  # JSON logs (pino); passwords, tokens and session ids are never logged
pm2 monit
```

Manual rollback to an older release (same checks as a deploy):

```bash
ls /srv/aricon/releases
bash /srv/aricon/releases/<id>/infra/scripts/activate-release.sh <id>
```

Changing a value in `/srv/aricon/shared/.env.*`: `pm2 startOrReload /srv/aricon/current/infra/ecosystem.config.cjs --update-env`.

## 11. Backups (SPEC §18.5)

`/srv/aricon/shared/mongodump.yaml` (mode 600) — in a file so the password never shows up in `ps`:

```yaml
uri: mongodb://aricon_backup:<password>@127.0.0.1:27017/?authSource=admin&replicaSet=rs0
```

`/srv/aricon/shared/backup.env` (mode 600):

```bash
MONGODUMP_CONFIG=/srv/aricon/shared/mongodump.yaml
R2_ACCOUNT_ID=<Cloudflare account id>
R2_BACKUP_ACCESS_KEY_ID=<backup token key id>
R2_BACKUP_SECRET_ACCESS_KEY=<backup token secret>
R2_PRIVATE_BUCKET=aricon-private
```

```bash
chmod 600 /srv/aricon/shared/mongodump.yaml /srv/aricon/shared/backup.env
ln -sfn /srv/aricon/current/infra/backup/backup-mongo.sh /srv/aricon/scripts/backup-mongo.sh
bash /srv/aricon/scripts/backup-mongo.sh          # run once now; check the file appears in R2
crontab -e                                        # as deploy, add:
# 02:30 Asia/Karachi (server clock is UTC)
30 21 * * * bash /srv/aricon/scripts/backup-mongo.sh >> /var/log/aricon/backup-mongo.log 2>&1
```

Keep Hostinger's weekly VPS backups switched on as a second layer.

### Restore

Fetch a backup (the `r2` remote comes from the same settings the backup script uses):

```bash
set -a; source /srv/aricon/shared/backup.env; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" \
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY"
rclone ls "r2:$R2_PRIVATE_BUCKET/backups/mongo/"
rclone copyto "r2:$R2_PRIVATE_BUCKET/backups/mongo/<date>.archive.gz" /var/backups/aricon/restore.archive.gz
```

**Restore drill (do it after the first backup, then monthly)** — restores into a throw-away mongod on
port 27018, so production is not touched:

```bash
mkdir -p /tmp/restore-test
mongod --dbpath /tmp/restore-test --port 27018 --bind_ip 127.0.0.1 --fork --logpath /tmp/restore-test.log
mongorestore --port 27018 --gzip --archive=/var/backups/aricon/restore.archive.gz --oplogReplay
mongosh --port 27018 --quiet --eval 'const d = db.getSiblingDB("aricon"); printjson({ orders: d.orders.countDocuments(), products: d.products.countDocuments(), users: d.users.countDocuments() })'
mongosh --port 27018 --quiet admin --eval 'db.shutdownServer()'
rm -rf /tmp/restore-test /tmp/restore-test.log /var/backups/aricon/restore.archive.gz
```

**Real restore** (replaces production data — stop the app first):

```bash
pm2 stop aricon-api aricon-web
mongorestore -u admin -p --authenticationDatabase admin --gzip \
  --archive=/var/backups/aricon/restore.archive.gz --oplogReplay --drop
pm2 start aricon-api aricon-web
```

## 12. Monitoring

- External uptime check (e.g. UptimeRobot, free): HTTPS monitor on
  `https://shop.aricon.com.pk/api/health`, every 5 minutes, alert by email. It returns
  `{"status":"ok","db":"ok"}`, or 503 when MongoDB is down.
- PM2 restarts a crashed process or one over its memory cap (API 450 MB, web 700 MB).
- Logs: `~/.pm2/logs` (rotated, 10 × 10 MB), `/var/log/nginx`, `/var/log/mongodb`, `/var/log/aricon/backup-mongo.log`.
- Disk: `df -h` now and then; five releases are a few hundred MB.
