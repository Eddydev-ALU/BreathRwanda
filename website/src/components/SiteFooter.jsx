import { Link } from 'react-router-dom'

export const REPO_URL = 'https://github.com/Eddydev-ALU/BreathRwanda'

const col = 'text-sm font-medium uppercase tracking-wider text-white/70'
const a = 'text-white underline-offset-4 hover:underline'

export default function SiteFooter() {
  return (
    <footer className="mt-24 bg-accent text-white">
      <div className="page-x grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl font-semibold">BreathRwanda</p>
          <p className="mt-3 max-w-sm text-white/85">
            Where clean cooking stoves protect the most children under 5 in Rwanda. A project for the NISR 2026 Big Data
            Hackathon by Eddy and De Noella.
          </p>
        </div>
        <div>
          <p className={col}>Explore</p>
          <ul className="mt-3 space-y-2">
            {[
              ['/problem', 'The Problem'],
              ['/map', 'Risk map'],
              ['/ranking', 'Ranking'],
              ['/planner', 'Plan a Budget'],
              ['/methods', 'Methods and Limits'],
            ].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className={`${a} no-underline`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={col}>Data</p>
          <ul className="mt-3 space-y-2 text-white/90">
            <li>NISR</li>
            <li>The DHS Program</li>
            <li>Rwanda Census 2022</li>
            <li>Rwanda Biomedical Centre</li>
          </ul>
        </div>
        <div>
          <p className={col}>Project</p>
          <ul className="mt-3 space-y-2">
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={a}>
                Code on GitHub
              </a>
            </li>
            <li>
              <Link to="/methods#credits" className={a}>
                Image credits
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/20">
        <p className="page-x py-6 text-sm text-white/80">
          AI tools were used for research, planning, code assistance and drafting support. The team reviewed, tested and
          is responsible for all analysis, code, results and text in this submission.
        </p>
      </div>
    </footer>
  )
}
