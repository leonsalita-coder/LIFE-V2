import type { Metadata } from 'next'
import { site } from '@/content/site'

export const metadata: Metadata = {
  title: 'Privacy · Vitality',
}

// Required by WHOOP (and most OAuth providers) to register a developer app.
// This is a real, honest description of this specific personal deployment —
// not a boilerplate template. It stays accurate because the app it describes
// has exactly one user: whoever forked and deployed it.
export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '64px 24px',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif',
        color: '#ededf0',
        background: '#050506',
        minHeight: '100vh',
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#fff' }}>Privacy</h1>
      <p style={{ color: '#a8a8b0', fontSize: 13, marginTop: 8 }}>
        Last updated 2026-08-01
      </p>

      <p style={{ marginTop: 28 }}>
        This is a personal, single-user dashboard{site.name ? ` built and run by ${site.name}` : ''}.
        It is not a company, not a product with sign-ups, and it does not
        collect or sell data from anyone. There is exactly one user: the
        person who deployed it.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, color: '#6EE7B7' }}>What data this app touches</h2>
      <p>
        Fitness and lifestyle data the owner enters or connects themselves —
        workouts, sleep, recovery, goals, progress photos, and (optionally)
        recovery data pulled from a connected WHOOP account. Nothing is
        collected from any other person.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, color: '#6EE7B7' }}>Where it&apos;s stored</h2>
      <p>
        In the owner&apos;s own Supabase project, which they created and
        control. This app has no shared server-side database — each
        deployment uses its own. Nothing is sent to the developer of this
        codebase or to any third party for analytics, advertising, or
        resale.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, color: '#6EE7B7' }}>WHOOP data specifically</h2>
      <p>
        If the owner connects a WHOOP account, this app requests read-only
        access to recovery, sleep, cycle, and profile data via WHOOP&apos;s
        official OAuth API, using the owner&apos;s own WHOOP developer
        credentials. Tokens and synced recovery scores are stored only in
        the owner&apos;s own Supabase project. The connection can be revoked
        at any time from the owner&apos;s WHOOP account settings, which
        immediately stops all data access.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, color: '#6EE7B7' }}>AI processing</h2>
      <p>
        Some features (workout suggestions, progress-photo notes) send the
        relevant data to Anthropic&apos;s Claude API using the owner&apos;s
        own API key, to generate a response. This happens only when the
        owner actively uses those features.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, color: '#6EE7B7' }}>Contact</h2>
      <p>
        Questions about a specific deployment of this app should go to the
        person who owns and runs it, since they are the sole operator and
        sole user of their own copy.
      </p>
    </main>
  )
}
