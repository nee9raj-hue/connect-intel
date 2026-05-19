/**
 * Builds app + copies to Connect intel root.
 * - index.html = small launcher (always opens when double-clicked)
 * - app.html = full app (single file)
 * - assets/ + site/ = for online hosting
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'frontend')

console.log('Building standalone app...')
execSync('npm run build', { cwd: frontend, stdio: 'inherit', env: { ...process.env, STANDALONE: '1' } })

console.log('Building deploy version (site/)...')
execSync('npm run build', { cwd: frontend, stdio: 'inherit' })

const standaloneDir = join(root, 'site-standalone')
const siteDir = join(root, 'site')

if (!existsSync(join(standaloneDir, 'index.html'))) {
  console.error('Build failed.')
  process.exit(1)
}

// Full app → app.html
cpSync(join(standaloneDir, 'index.html'), join(root, 'app.html'))

// Small launcher → index.html (works on double-click in any browser)
writeFileSync(
  join(root, 'index.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect Intel — Open App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%);
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px; color: #fff;
    }
    .card {
      background: #fff; color: #111; border-radius: 16px; padding: 40px;
      max-width: 480px; width: 100%; box-shadow: 0 24px 80px rgba(0,0,0,0.4);
    }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .mark {
      width: 40px; height: 40px; background: #f5c518; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; color: #1a1f2e;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 20px; }
    .btn {
      display: block; width: 100%; padding: 14px; margin-bottom: 10px;
      border: none; border-radius: 10px; font-size: 15px; font-weight: 700;
      cursor: pointer; text-align: center; text-decoration: none;
    }
    .btn-primary { background: #f5c518; color: #1a1f2e; }
    .btn-primary:hover { background: #e6b800; }
    .btn-secondary { background: #1a1f2e; color: #fff; }
    .btn-secondary:hover { background: #2d3748; }
    .note { font-size: 12px; color: #888; margin-top: 16px; line-height: 1.5; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="mark">CI</div>
      <strong style="font-size:18px">Connect Intel</strong>
    </div>
    <h1>Open the app</h1>
    <p>Browsers block the full app when opened as a plain file. Use one of these options:</p>

    <a class="btn btn-primary" href="app.html" id="tryApp">Try opening app.html</a>
    <p class="note" id="fileWarning" style="display:none;color:#b45309;">
      If the next page is blank, use the Mac launcher below instead.
    </p>

    <p class="note"><strong>Mac (recommended):</strong> Double-click<br>
    <code>OPEN CONNECT INTEL.command</code><br>in this folder.</p>

    <p class="note"><strong>Terminal:</strong><br>
    <code>cd "${root.replace(/\\/g, '/')}"</code><br>
    <code>npx serve .</code><br>
    Then open the localhost link.</p>
  </div>
  <script>
    if (location.protocol === 'file:') {
      document.getElementById('fileWarning').style.display = 'block';
    }
  </script>
</body>
</html>`.replace(/\$\{root\}/g, root.replace(/\\/g, '/'))
)

if (existsSync(join(standaloneDir, 'favicon.svg'))) {
  cpSync(join(standaloneDir, 'favicon.svg'), join(root, 'favicon.svg'))
}

const rootAssets = join(root, 'assets')
if (existsSync(rootAssets)) rmSync(rootAssets, { recursive: true })
if (existsSync(join(siteDir, 'assets'))) {
  cpSync(join(siteDir, 'assets'), rootAssets, { recursive: true })
}

console.log('')
console.log('✓ Connect intel folder ready')
console.log('  Double-click: index.html (launcher) or OPEN CONNECT INTEL.command (full app)')
