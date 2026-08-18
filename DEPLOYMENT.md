# StorePulse SaaS - Self-Hosted Backend & Database Deployment Guide

## 1. Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start server in development mode
npm run dev

# 3. Access Dashboards:
# Web Portal:       http://localhost:3000
# Manager Live:     http://localhost:3000/manager.html
# SaaS Admin:       http://localhost:3000/admin.html
# POS / Sandbox:    http://localhost:3000/pos-tester.html
```

---

## 2. Deploy for FREE on Render.com

1. Create a new Web Service on Render.com from your repository.
2. Configure settings:
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
3. Add a Persistent Disk mounted at `/app/data` (1GB or 5GB) so your SQLite database file (`storepulse.db`) persists across deployments.
4. Deploy! Render will provision your URL with automatic HTTPS and WebSocket support.

---

## 3. Production Deployment on a $5/month VPS (Ubuntu 22.04 / 24.04)

### Step 1: Install Node.js 20 & PM2
```bash
sudo apt update && sudo apt install -y curl git sqlite3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### Step 2: Clone & Build
```bash
cd /var/www
git clone https://github.com/your-username/storepulse-saas.git storepulse
cd storepulse
npm install
npm run build
```

### Step 3: Run with PM2 Process Manager
```bash
pm2 start dist/server.cjs --name "storepulse-saas"
pm2 startup
pm2 save
```

### Step 4: Caddy SSL Reverse Proxy (Auto Let's Encrypt SSL)
```bash
sudo apt install -y caddy
```
Edit `/etc/caddy/Caddyfile`:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```
Reload Caddy:
```bash
sudo systemctl reload caddy
```

### Step 5: Automated Daily SQLite Backup
```bash
crontab -e
```
Add:
```cron
0 3 * * * sqlite3 /var/www/storepulse/data/storepulse.db ".backup '/var/backups/storepulse_$(date +\%F).db'"
```

---

## 4. API Reference

### Ingest Invoice (Single Transaction)
- **Endpoint:** `POST /api/invoices`
- **Header:** `x-api-key: sk_live_...`
- **Body:**
```json
{
  "store_id": "STORE-DOWNTOWN-01",
  "invoice_number": "INV-10045",
  "customer_name": "Sarah Miller",
  "payment_method": "card",
  "tax": 1.20,
  "discount": 0.00,
  "items": [
    { "item_name": "Cold Brew", "category": "Beverages", "quantity": 2, "unit_price": 4.50 },
    { "item_name": "Almond Croissant", "category": "Bakery", "quantity": 1, "unit_price": 3.95 }
  ],
  "timestamp": "2026-08-18T13:30:00Z"
}
```

### Aggregated Items (`GROUP BY item_name`)
- **Endpoint:** `GET /api/analytics/items-aggregation?store_id=ALL&sort_by=revenue`
