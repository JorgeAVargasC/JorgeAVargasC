// Genera assets/activity.svg y assets/languages.svg con la paleta del portafolio.
// Uso: GITHUB_TOKEN=... USERNAME=JorgeAVargasC node scripts/generate-stats.mjs
// Sin token: MOCK=1 node scripts/generate-stats.mjs (datos de prueba)
import { writeFileSync, mkdirSync } from 'node:fs'

const C = {
  base: '#151518', surface: '#1d1d21', line: '#2b2b31', bone: '#ededE8',
  body: '#a6a6ad', muted: '#8f8f96', accent: '#c6f24e',
}
const FONT_MONO = "'JetBrains Mono','Cascadia Code','SF Mono',Consolas,Menlo,monospace"
const FONT_SANS = "'Space Grotesk','Inter','Segoe UI',-apple-system,Helvetica,Arial,sans-serif"
// 0 contribuciones → surface; el resto, rampa hacia el acento (estado/intensidad).
const HEAT = ['#1d1d21', '#3a4224', '#62772c', '#93b73c', '#c6f24e']

const USER = process.env.USERNAME || 'JorgeAVargasC'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date weekday } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 6, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`

async function fetchData() {
  if (process.env.MOCK) return mock()
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('Falta GITHUB_TOKEN')
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme-stats' },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data.user
}

function mock() {
  const weeks = []
  const start = new Date(); start.setUTCDate(start.getUTCDate() - 7 * 52 - start.getUTCDay())
  let n = 0
  for (let w = 0; w < 53; w++) {
    const contributionDays = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 864e5)
      if (date > new Date()) break
      const c = (w * 7 + d) % 9 < 3 ? 0 : ((w * 3 + d * 5) % 11)
      n += c
      contributionDays.push({ contributionCount: c, date: date.toISOString().slice(0, 10), weekday: d })
    }
    weeks.push({ contributionDays })
  }
  return {
    contributionsCollection: {
      totalCommitContributions: 812, totalPullRequestContributions: 64,
      contributionCalendar: { totalContributions: n, weeks },
    },
    repositories: { totalCount: 31, nodes: [
      { stargazerCount: 3, languages: { edges: [{ size: 700, node: { name: 'TypeScript' } }, { size: 200, node: { name: 'CSS' } }, { size: 90, node: { name: 'Python' } }] } },
      { stargazerCount: 1, languages: { edges: [{ size: 300, node: { name: 'JavaScript' } }, { size: 40, node: { name: 'HTML' } }] } },
    ] },
  }
}

function streaks(days) {
  let longest = 0, run = 0
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run) }
  // racha actual: hoy aún puede estar en 0 sin romperla.
  let current = 0, i = days.length - 1
  if (i >= 0 && days[i].contributionCount === 0) i--
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++
  return { current, longest }
}

function level(c, max) {
  if (c <= 0) return 0
  const r = c / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}

function activitySvg(u) {
  const cal = u.contributionsCollection.contributionCalendar
  const days = cal.weeks.flatMap((w) => w.contributionDays)
  const max = Math.max(1, ...days.map((d) => d.contributionCount))
  const { current, longest } = streaks(days)
  const W = 800, H = 300, cell = 11, gap = 3, x0 = 32, y0 = 128
  const cells = cal.weeks.map((w, wi) =>
    w.contributionDays.map((d) =>
      `<rect x="${x0 + wi * (cell + gap)}" y="${y0 + d.weekday * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${HEAT[level(d.contributionCount, max)]}"><title>${esc(d.date)}: ${d.contributionCount}</title></rect>`
    ).join('')
  ).join('')
  const stat = (x, value, label) =>
    `<text x="${x}" y="92" font-family="${FONT_SANS}" font-size="30" font-weight="700" fill="${C.bone}">${esc(value)}</text>` +
    `<text x="${x}" y="112" font-family="${FONT_MONO}" font-size="11" letter-spacing="1.5" fill="${C.muted}">${esc(label)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Actividad en GitHub: ${cal.totalContributions} contribuciones en el último año">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.base}" stroke="${C.line}"/>
  <text x="32" y="38" font-family="${FONT_MONO}" font-size="13" letter-spacing="2" fill="${C.muted}">ACTIVITY / LAST 12 MONTHS</text>
  <circle cx="${W - 40}" cy="34" r="4" fill="${C.accent}"/>
  <line x1="0" y1="56" x2="${W}" y2="56" stroke="${C.line}"/>
  ${stat(32, cal.totalContributions, 'CONTRIBUTIONS')}
  ${stat(250, u.contributionsCollection.totalCommitContributions, 'COMMITS')}
  ${stat(430, u.contributionsCollection.totalPullRequestContributions, 'PULL REQUESTS')}
  ${stat(620, `${current} / ${longest}`, 'STREAK NOW / BEST')}
  ${cells}
</svg>
`
}

function languagesSvg(u) {
  const totals = new Map()
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) totals.set(e.node.name, (totals.get(e.node.name) || 0) + e.size)
  const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const W = 800, rowH = 34, H = 56 + 24 + top.length * rowH + 16
  const barX = 190, barW = 520
  const rows = top.map(([name, size], i) => {
    const pct = (size / sum) * 100, y = 96 + i * rowH
    return `<text x="32" y="${y + 4}" font-family="${FONT_MONO}" font-size="14" fill="${C.bone}">${esc(name)}</text>` +
      `<rect x="${barX}" y="${y - 6}" width="${barW}" height="8" rx="4" fill="${C.surface}"/>` +
      `<rect x="${barX}" y="${y - 6}" width="${Math.max(6, (barW * pct) / 100).toFixed(1)}" height="8" rx="4" fill="${i === 0 ? C.accent : C.body}"/>` +
      `<text x="${W - 32}" y="${y + 4}" text-anchor="end" font-family="${FONT_MONO}" font-size="13" fill="${C.muted}">${pct.toFixed(1)}%</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lenguajes más usados en repositorios públicos">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.base}" stroke="${C.line}"/>
  <text x="32" y="38" font-family="${FONT_MONO}" font-size="13" letter-spacing="2" fill="${C.muted}">LANGUAGES / PUBLIC REPOS</text>
  <line x1="0" y1="56" x2="${W}" y2="56" stroke="${C.line}"/>
  ${rows}
</svg>
`
}

const user = await fetchData()
mkdirSync('assets', { recursive: true })
writeFileSync('assets/activity.svg', activitySvg(user))
writeFileSync('assets/languages.svg', languagesSvg(user))
console.log('OK: assets/activity.svg, assets/languages.svg')
