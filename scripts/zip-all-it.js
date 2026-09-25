import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const distPath = path.resolve(ROOT, 'dist');
const appPath = path.resolve(ROOT, 'src/App.jsx');
const originalApp = fs.readFileSync(appPath, 'utf8');

const IT_DASHBOARDS = [
  'ITEmployeeDashboardProject',
  'ITAgentDashboardProject',
  'ITManagerDashboardProject',
  'ITAdminDashboardProject',
];

function buildAppSnippet(componentName) {
  return `import ${componentName} from './${componentName}.jsx'

function App() {
  return (
    <div className="rootDiv">
      <${componentName} />
    </div>
  )
}

export default App
`;
}

function buildProject() {
  execSync('npx vite build', {
    stdio: 'inherit',
    cwd: ROOT,
    env: {
      ...process.env,
      ZIP_BUILD: '1',
      KF_MANIFEST_CATEGORY: 'Component',
    },
  });
}

async function zipDistFolder(zipFilePath) {
  if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.glob('**/*', {
    cwd: distPath,
    ignore: ['**/*.map'],
  });
  await archive.finalize();
}

async function buildZipFor(componentName) {
  const zipFilePath = path.resolve(ROOT, `${componentName}.zip`);
  fs.writeFileSync(appPath, buildAppSnippet(componentName), 'utf8');
  if (fs.existsSync(distPath)) fs.rmSync(distPath, { recursive: true, force: true });
  console.log(`\n▶ Building ${componentName}.zip`);
  buildProject();
  await zipDistFolder(zipFilePath);
  console.log(`✓ ${componentName}.zip`);
}

try {
  for (const name of IT_DASHBOARDS) {
    await buildZipFor(name);
  }
} finally {
  fs.writeFileSync(appPath, originalApp, 'utf8');
  console.log('\nRestored src/App.jsx');
  console.log('Done — 4 IT dashboard zip files generated.');
}
