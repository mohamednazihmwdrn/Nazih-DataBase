import React, { useState } from 'react';
import {
  Server,
  Cloud,
  Terminal,
  ShieldCheck,
  HardDrive,
  Copy,
  Check,
  Layers,
  FileCode,
} from 'lucide-react';

export const DeploymentCenter: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'vps' | 'render' | 'fly' | 'files'>('vps');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                100% Self-Hosted & Owned
              </span>
              <span className="text-xs text-slate-500 font-mono">Zero Firebase Subscriptions</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
              Independent SaaS Production Deployment
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Host this backend on a $0 Free Tier (Render/Fly) or a $5/month VPS. Includes SQLite ACID single-write transactions, WebSockets on port 3000, and cryptographic API key gating.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href="/deployment.html"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-2 shadow-xs cursor-pointer"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Open Standalone HTML Guide</span>
            </a>
          </div>
        </div>

        {/* SUB TABS */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-slate-200 pt-4">
          <button
            onClick={() => setActiveSubTab('vps')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'vps'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>$5/mo VPS (PM2 + Caddy SSL)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('render')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'render'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Free Tier on Render.com</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'fly'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Docker & Fly.io</span>
          </button>

          <button
            onClick={() => setActiveSubTab('files')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'files'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Source Code Files</span>
          </button>
        </div>
      </div>

      {/* CONTENT TABS */}
      {activeSubTab === 'vps' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Full Guide: Ubuntu 22.04 / 24.04 VPS Deployment</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ideal for a $4 - $5/mo VPS on Hetzner, DigitalOcean, Linode, or Vultr.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-semibold">
              Production Standard
            </span>
          </div>

          <div className="space-y-4 text-xs text-slate-700">
            {/* STEP 1 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 1: Install Node.js 20 & PM2
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `sudo apt update && sudo apt install -y curl git sqlite3\ncurl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt install -y nodejs\nsudo npm install -g pm2`,
                      'vps-step-1'
                    )
                  }
                  className="text-slate-500 hover:text-blue-600 flex items-center space-x-1 font-medium cursor-pointer"
                >
                  {copiedSection === 'vps-step-1' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === 'vps-step-1' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-emerald-400 bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`sudo apt update && sudo apt install -y curl git sqlite3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2`}
              </pre>
            </div>

            {/* STEP 2 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 2: Clone & Build StorePulse SaaS
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `cd /var/www\ngit clone https://github.com/your-username/storepulse-saas.git storepulse\ncd storepulse\nnpm install\nnpm run build\npm2 start dist/server.cjs --name "storepulse-saas"\npm2 startup\npm2 save`,
                      'vps-step-2'
                    )
                  }
                  className="text-slate-500 hover:text-blue-600 flex items-center space-x-1 font-medium cursor-pointer"
                >
                  {copiedSection === 'vps-step-2' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === 'vps-step-2' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-blue-300 bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`cd /var/www
git clone https://github.com/your-username/storepulse-saas.git storepulse
cd storepulse
npm install
npm run build
pm2 start dist/server.cjs --name "storepulse-saas"
pm2 startup
pm2 save`}
              </pre>
            </div>

            {/* STEP 3 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 3: Setup Automated Free SSL with Caddy Reverse Proxy
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `sudo apt install -y caddy\n# Edit /etc/caddy/Caddyfile:\n# yourdomain.com {\n#   reverse_proxy localhost:3000\n# }\nsudo systemctl reload caddy`,
                      'vps-step-3'
                    )
                  }
                  className="text-slate-500 hover:text-blue-600 flex items-center space-x-1 font-medium cursor-pointer"
                >
                  {copiedSection === 'vps-step-3' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === 'vps-step-3' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-300 bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`# 1. Install Caddy
sudo apt install -y caddy

# 2. Configure /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}

# 3. Reload Caddy
sudo systemctl reload caddy`}
              </pre>
            </div>

            {/* STEP 4 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Step 4: Automated Nightly SQLite Backup Cron Job
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `0 3 * * * sqlite3 /var/www/storepulse/data/storepulse.db ".backup '/var/backups/storepulse_\$(date +\\%F).db'"`,
                      'vps-step-4'
                    )
                  }
                  className="text-slate-500 hover:text-blue-600 flex items-center space-x-1 font-medium cursor-pointer"
                >
                  {copiedSection === 'vps-step-4' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === 'vps-step-4' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-amber-300 bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`# Add via: crontab -e
0 3 * * * sqlite3 /var/www/storepulse/data/storepulse.db ".backup '/var/backups/storepulse_\$(date +\\%F).db'"`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'render' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Deploy for Free on Render.com</h2>
          <ol className="list-decimal list-inside text-xs text-slate-700 space-y-3 leading-relaxed">
            <li>Sign up at <strong>Render.com</strong> and click <strong>New &rarr; Web Service</strong>.</li>
            <li>Connect your GitHub repository.</li>
            <li>
              Set the configurations:
              <div className="mt-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-[11px] space-y-1 text-slate-800">
                <div>Environment: <span className="text-emerald-700 font-semibold">Node</span></div>
                <div>Build Command: <span className="text-blue-700 font-semibold">npm run build</span></div>
                <div>Start Command: <span className="text-blue-700 font-semibold">npm start</span></div>
                <div>Instance Type: <span className="text-cyan-700 font-semibold">Free</span></div>
              </div>
            </li>
            <li>
              <strong>Persistent Disk (Recommended):</strong> Attach a disk mounted at <code className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">/app/data</code> so the SQLite database file persists safely across git deploys.
            </li>
            <li>Click <strong>Create Web Service</strong>!</li>
          </ol>
        </div>
      )}

      {activeSubTab === 'fly' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Docker & Fly.io Zero-Config Deployment</h2>
          <p className="text-xs text-slate-600">
            Launch instantly using Docker and persistent volume mounting:
          </p>
          <pre className="text-xs font-mono text-emerald-400 bg-slate-900 p-4 rounded-xl border border-slate-800">
{`# 1. Install Fly CLI and Login
fly auth login

# 2. Launch app
fly launch

# 3. Create persistent SQLite disk volume
fly volumes create storepulse_data --size 1

# 4. Deploy
fly deploy`}
          </pre>
        </div>
      )}

      {activeSubTab === 'files' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Exportable Clean Node.js Code Artifacts</h2>
          <p className="text-xs text-slate-600">
            Below are the primary core server files generated for direct self-hosting:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-blue-700 font-bold">/server.ts / /server.js</div>
              <div className="text-[11px] text-slate-500 mt-1 font-sans">Main Express HTTP + WebSocket Server Entry</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-emerald-700 font-bold">/server/db.ts</div>
              <div className="text-[11px] text-slate-500 mt-1 font-sans">SQLite ACID Transactions & Auto-Archive Engine</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-cyan-700 font-bold">/server/routes.ts</div>
              <div className="text-[11px] text-slate-500 mt-1 font-sans">API Key Auth & Ingestion Endpoints</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-purple-700 font-bold">/server/realtime.ts</div>
              <div className="text-[11px] text-slate-500 mt-1 font-sans">WebSocket Broadcast Stream Hub</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
