import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sharedFiles = [
  'background.js',
  'parser.js',
  'maps.js',
  'options.html',
  'options.js',
  'settings.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'fonts/GeistVF.woff',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
]

export function browserManifest(manifest, target) {
  if (!['chrome', 'firefox'].includes(target)) throw new Error(`Unknown browser: ${target}`)
  if (target === 'chrome') return structuredClone(manifest)

  return {
    ...structuredClone(manifest),
    background: { scripts: ['background.js'], type: 'module' },
    browser_specific_settings: {
      gecko: {
        id: 'placeshub-sync@emanuelet.github.io',
        strict_min_version: '142.0',
        data_collection_permissions: {
          required: ['authenticationInfo', 'bookmarksInfo', 'locationInfo', 'websiteContent'],
        },
      },
    },
  }
}

async function packageBrowser(target, manifest) {
  const source = join(root, 'dist', target)
  const artifacts = join(root, 'artifacts', target)
  await rm(source, { recursive: true, force: true })
  await mkdir(source, { recursive: true })
  await mkdir(artifacts, { recursive: true })
  for (const path of sharedFiles) {
    await mkdir(dirname(join(source, path)), { recursive: true })
    await copyFile(join(root, path), join(source, path))
  }
  await writeFile(
    join(source, 'manifest.json'),
    `${JSON.stringify(browserManifest(manifest, target), null, 2)}\n`,
  )
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(
    command,
    [
      'exec',
      'web-ext',
      'build',
      '--source-dir',
      source,
      '--artifacts-dir',
      artifacts,
      '--overwrite-dest',
    ],
    { cwd: root, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${target} packaging failed (exit ${result.status})`)
}

async function main() {
  const target = process.argv[2] ?? 'all'
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  const browsers = target === 'all' ? ['chrome', 'firefox'] : [target]
  for (const browser of browsers) await packageBrowser(browser, manifest)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
