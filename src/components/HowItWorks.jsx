import React from 'react';
import {
  ClipboardPaste, Sparkles, BrainCircuit, FileText,
  Image as ImageIcon, Zap, BookOpen, Target,
  ShieldCheck, LayoutGrid, ArrowRight,
} from 'lucide-react';

const STEPS = [
  {
    icon: ClipboardPaste,
    step: '01',
    title: 'Paste or upload your content',
    desc: 'Drop raw lecture notes, meeting transcripts, or study material into the input box — or upload a PDF / image and let NoteAI extract the text automatically.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'AI summarizes in seconds',
    desc: 'Google Gemini reads your content and returns a clean, structured summary with the key ideas, conclusions, and action points — no fluff, no filler.',
  },
  {
    icon: BrainCircuit,
    step: '03',
    title: 'Test yourself with a quiz',
    desc: 'One click turns your summary into an interactive multiple-choice quiz so you can check retention, spot gaps, and lock in the knowledge.',
  },
];

const USE_CASES = [
  { icon: Zap,        title: 'Instant AI Summaries',   useCase: 'Condense an hour-long lecture or a 20-page PDF into bullet-point clarity in under 10 seconds.' },
  { icon: BrainCircuit, title: 'Smart Quiz Generation', useCase: 'Auto-generate 5–10 multiple-choice questions from any summary to reinforce learning.' },
  { icon: FileText,   title: 'PDF Upload & Parsing',    useCase: 'Upload any PDF and extract all readable text instantly without manual copy-paste.' },
  { icon: ImageIcon,  title: 'Image OCR Extraction',    useCase: 'Photograph handwritten notes or a whiteboard and NoteAI pulls the text for you.' },
  { icon: BookOpen,   title: 'Key Idea Extraction',     useCase: 'Get only the decisions, facts, and takeaways that actually matter — curated by AI.' },
  { icon: Target,     title: 'Focused Recall Testing',  useCase: 'Study smarter with targeted quizzes — perfect for exam prep or onboarding.' },
  { icon: ShieldCheck, title: 'Secure & Private',       useCase: 'Your notes are processed in real time and never stored permanently on our servers.' },
  { icon: LayoutGrid, title: 'Clean Workspace',         useCase: 'Paste, summarize, quiz — one focused interface with no clutter.' },
];

const HowItWorks = ({ onGetStarted }) => (
  <div className="hiw-page">

    {/* Page header */}
    <div className="hiw-page-header">
      <div className="hero-eyebrow" style={{ margin: '0 auto 1rem', display: 'inline-flex' }}>
        <Sparkles size={15} />
        How it works
      </div>
      <h2 className="hiw-page-title">
        From messy notes to crystal-clear insights
      </h2>
      <p className="hiw-page-sub">
        Three simple steps — no setup, no learning curve.
      </p>
    </div>

    {/* Steps */}
    <div className="hiw-steps">
      {STEPS.map(({ icon: Icon, step, title, desc }) => (
        <div key={step} className="hiw-step-card premium-card">
          <div className="hiw-step-top">
            <div className="hiw-step-icon-wrap"><Icon size={22} /></div>
            <span className="hiw-step-number">{step}</span>
          </div>
          <h3 className="hiw-step-title">{title}</h3>
          <p className="hiw-step-desc">{desc}</p>
        </div>
      ))}
    </div>

    {/* Connector */}
    <div className="hiw-connector">
      <div className="hiw-connector-line" />
    </div>

    {/* Divider label */}
    <div className="hiw-divider">
      <span>Feature use cases</span>
    </div>

    {/* Use case grid */}
    <div className="hiw-use-cases">
      {USE_CASES.map(({ icon: Icon, title, useCase }) => (
        <div key={title} className="hiw-uc-card">
          <div className="hiw-uc-icon"><Icon size={19} /></div>
          <div>
            <h4 className="hiw-uc-title">{title}</h4>
            <p className="hiw-uc-text">{useCase}</p>
          </div>
        </div>
      ))}
    </div>

    {/* CTA banner */}
    <div className="hiw-cta-banner">
      <div>
        <h3 className="hiw-cta-title">Ready to try it?</h3>
        <p className="hiw-cta-sub">Paste your first note and get a summary in seconds.</p>
      </div>
      <button className="btn-primary hiw-cta-btn" onClick={onGetStarted}>
        Get started free <ArrowRight size={16} />
      </button>
    </div>

    <style>{`
      .hiw-page {
        width: 100%;
        max-width: 1080px;
        margin: 0 auto;
        padding: 0 clamp(0rem, 2vw, 1.5rem);
      }
      .hiw-page-header {
        text-align: center;
        margin-bottom: 2.75rem;
        padding-top: 1rem;
      }
      .hiw-page-title {
        font-size: clamp(1.875rem, 4.5vw, 3rem);
        font-weight: 800;
        line-height: 1.1;
        color: var(--text-primary);
        margin-bottom: 0.875rem;
      }
      .hiw-page-sub {
        font-size: clamp(1rem, 1.5vw, 1.125rem);
        color: var(--text-secondary);
        max-width: 440px;
        margin: 0 auto;
        line-height: 1.65;
      }

      /* ── Steps ─────────────────────────────────────── */
      .hiw-steps {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
        margin-bottom: 1rem;
      }
      .hiw-step-card {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        position: relative;
      }
      .hiw-step-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .hiw-step-icon-wrap {
        width: 48px; height: 48px;
        border-radius: var(--radius-md);
        background: linear-gradient(135deg, hsla(262,80%,60%,0.15), hsla(262,80%,60%,0.06));
        border: 1px solid hsla(262,80%,60%,0.2);
        display: flex; align-items: center; justify-content: center;
        color: var(--accent-primary);
        flex-shrink: 0;
      }
      .hiw-step-number {
        font-size: 2.25rem;
        font-weight: 800;
        font-family: var(--font-heading);
        color: hsla(262,80%,60%,0.13);
        line-height: 1;
        letter-spacing: -2px;
        user-select: none;
      }
      .hiw-step-title {
        font-size: 1.0625rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.3;
      }
      .hiw-step-desc {
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.7;
        flex: 1;
      }

      /* ── Connector ──────────────────────────────────── */
      .hiw-connector {
        display: flex;
        justify-content: center;
        margin: 0.5rem 0 2rem;
      }
      .hiw-connector-line {
        width: 2px;
        height: 40px;
        background: linear-gradient(180deg, var(--accent-primary), transparent);
        border-radius: 2px;
        opacity: 0.4;
      }

      /* ── Divider ──────────────────────────────────── */
      .hiw-divider {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.75rem;
        color: var(--text-tertiary);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .hiw-divider::before, .hiw-divider::after {
        content: ''; flex: 1; height: 1px; background: var(--border-color);
      }

      /* ── Use cases grid ───────────────────────────── */
      .hiw-use-cases {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-bottom: 2.5rem;
      }
      .hiw-uc-card {
        display: flex;
        align-items: flex-start;
        gap: 0.875rem;
        padding: 1rem 1.125rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background-color: var(--bg-secondary);
        transition: var(--transition);
      }
      .hiw-uc-card:hover {
        border-color: hsla(262,80%,60%,0.35);
        background-color: hsla(262,80%,60%,0.04);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      @media (hover: none) { .hiw-uc-card:hover { transform: none; } }
      .hiw-uc-icon {
        width: 38px; height: 38px; min-width: 38px;
        border-radius: var(--radius-sm);
        background: linear-gradient(135deg, hsla(262,80%,60%,0.14), hsla(262,80%,60%,0.06));
        border: 1px solid hsla(262,80%,60%,0.18);
        display: flex; align-items: center; justify-content: center;
        color: var(--accent-primary);
        margin-top: 1px;
      }
      .hiw-uc-title {
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 0.3rem;
        line-height: 1.25;
      }
      .hiw-uc-text {
        font-size: 0.85rem;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      /* ── CTA banner ───────────────────────────────── */
      .hiw-cta-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 1.75rem 2rem;
        border-radius: var(--radius-lg);
        border: 1px solid hsla(262,80%,60%,0.25);
        background: linear-gradient(135deg, hsla(262,80%,60%,0.08), hsla(190,78%,52%,0.06));
        margin-bottom: 2rem;
        flex-wrap: wrap;
      }
      .hiw-cta-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }
      .hiw-cta-sub {
        font-size: 0.9375rem;
        color: var(--text-secondary);
      }
      .hiw-cta-btn {
        display: inline-flex;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 700;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Responsive ───────────────────────────────── */
      @media (max-width: 959px) {
        .hiw-use-cases { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 767px) {
        .hiw-steps { grid-template-columns: 1fr; gap: 1rem; }
        .hiw-connector { display: none; }
      }
      @media (max-width: 639px) {
        .hiw-use-cases { grid-template-columns: 1fr; }
        .hiw-page-header { margin-bottom: 1.75rem; }
        .hiw-cta-banner {
          flex-direction: column;
          align-items: flex-start;
          padding: 1.25rem;
          gap: 1rem;
        }
        .hiw-cta-btn { width: 100%; justify-content: center; }
      }
    `}</style>
  </div>
);

export default HowItWorks;
