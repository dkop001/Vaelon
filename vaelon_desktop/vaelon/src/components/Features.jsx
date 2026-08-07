import React from 'react';
import {
  Zap, BrainCircuit, FileText, Image as ImageIcon,
  BookOpen, Target, ShieldCheck, LayoutGrid,
  ArrowRight, Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant AI Summaries',
    desc: 'Condense an hour-long lecture or a 20-page PDF into bullet-point clarity in under 10 seconds. Powered by Google Gemini.',
    tag: 'Core',
  },
  {
    icon: BrainCircuit,
    title: 'Smart Quiz Generation',
    desc: 'Auto-generate 5–10 multiple-choice questions from any summary to reinforce learning and test your retention instantly.',
    tag: 'Learning',
  },
  {
    icon: FileText,
    title: 'PDF Upload & Parsing',
    desc: 'Upload any PDF — textbooks, research papers, contracts — and extract all readable text instantly without manual copy-paste.',
    tag: 'Import',
  },
  {
    icon: ImageIcon,
    title: 'Image OCR Extraction',
    desc: 'Photograph handwritten notes or a whiteboard, upload the image, and NoteAI pulls the text so you can summarize it.',
    tag: 'Import',
  },
  {
    icon: BookOpen,
    title: 'Key Idea Extraction',
    desc: 'Instead of re-reading everything, get only the decisions, facts, and takeaways that actually matter — curated by AI.',
    tag: 'Core',
  },
  {
    icon: Target,
    title: 'Focused Recall Testing',
    desc: 'Study smarter with targeted quizzes that adapt to the content you just summarized — perfect for exam prep or onboarding.',
    tag: 'Learning',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Private',
    desc: 'Your notes are processed in real time and never stored permanently on our servers. Your data stays entirely yours.',
    tag: 'Privacy',
  },
  {
    icon: LayoutGrid,
    title: 'Clean Workspace',
    desc: 'One focused interface — paste, summarize, quiz. No clutter, no context-switching, no wasted time.',
    tag: 'UX',
  },
];

const TAG_COLORS = {
  Core:     { bg: 'hsla(262,80%,60%,0.12)', color: 'var(--accent-primary)', border: 'hsla(262,80%,60%,0.25)' },
  Learning: { bg: 'hsla(158,68%,38%,0.12)', color: 'hsl(158,68%,42%)',     border: 'hsla(158,68%,38%,0.25)' },
  Import:   { bg: 'hsla(40,90%,55%,0.12)',  color: 'hsl(38,90%,45%)',      border: 'hsla(40,90%,55%,0.25)'  },
  Privacy:  { bg: 'hsla(220,80%,60%,0.12)', color: 'hsl(220,80%,58%)',     border: 'hsla(220,80%,60%,0.25)' },
  UX:       { bg: 'hsla(300,60%,60%,0.1)',  color: 'hsl(300,50%,55%)',     border: 'hsla(300,60%,60%,0.22)' },
};

const Features = ({ onGetStarted }) => (
  <div className="feat-page">
    {/* Page header */}
    <div className="feat-page-header">
      <div className="hero-eyebrow" style={{ margin: '0 auto 1rem', display: 'inline-flex' }}>
        <Sparkles size={15} />
        Everything you need
      </div>
      <h2 className="feat-page-title">
        Powerful features,<br />zero learning curve.
      </h2>
      <p className="feat-page-sub">
        NoteAI packs every tool a student, researcher, or professional needs to go from raw notes to confident understanding.
      </p>
      <button className="btn-primary feat-page-cta" onClick={onGetStarted}>
        Start for free <ArrowRight size={16} />
      </button>
    </div>

    {/* Features grid */}
    <div className="feat-grid">
      {FEATURES.map(({ icon: Icon, title, desc, tag }) => {
        const tagStyle = TAG_COLORS[tag] || TAG_COLORS.Core;
        return (
          <div key={title} className="feat-card premium-card">
            <div className="feat-card-top">
              <div className="feat-card-icon">
                <Icon size={22} />
              </div>
              <span className="feat-tag" style={{
                backgroundColor: tagStyle.bg,
                color: tagStyle.color,
                border: `1px solid ${tagStyle.border}`,
              }}>
                {tag}
              </span>
            </div>
            <h3 className="feat-card-title">{title}</h3>
            <p className="feat-card-desc">{desc}</p>
          </div>
        );
      })}
    </div>

    <style>{`
      .feat-page {
        width: 100%;
        max-width: 1080px;
        margin: 0 auto;
        padding: 0 clamp(0rem, 2vw, 1.5rem);
      }
      .feat-page-header {
        text-align: center;
        margin-bottom: 3rem;
        padding: 2rem 1rem 0;
      }
      .feat-page-title {
        font-size: clamp(2rem, 5vw, 3.25rem);
        font-weight: 800;
        line-height: 1.08;
        color: var(--text-primary);
        margin-bottom: 1rem;
      }
      .feat-page-sub {
        font-size: clamp(1rem, 1.6vw, 1.125rem);
        color: var(--text-secondary);
        max-width: 540px;
        margin: 0 auto 1.75rem;
        line-height: 1.65;
      }
      .feat-page-cta {
        display: inline-flex;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 700;
      }

      /* Grid */
      .feat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1.125rem;
        margin-bottom: 3rem;
      }
      .feat-card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        cursor: default;
      }
      .feat-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .feat-card-icon {
        width: 46px;
        height: 46px;
        min-width: 46px;
        border-radius: var(--radius-md);
        background: linear-gradient(135deg, hsla(262,80%,60%,0.15), hsla(262,80%,60%,0.06));
        border: 1px solid hsla(262,80%,60%,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent-primary);
      }
      .feat-tag {
        padding: 0.25rem 0.6rem;
        border-radius: var(--radius-full);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
        margin-top: 4px;
      }
      .feat-card-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.3;
      }
      .feat-card-desc {
        font-size: 0.875rem;
        color: var(--text-secondary);
        line-height: 1.65;
        flex: 1;
      }

      /* Responsive */
      @media (max-width: 1023px) {
        .feat-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 639px) {
        .feat-grid { grid-template-columns: 1fr; gap: 0.875rem; }
        .feat-page-header { padding-top: 0.5rem; margin-bottom: 2rem; }
        .feat-page-cta { width: 100%; max-width: 320px; justify-content: center; }
      }
    `}</style>
  </div>
);

export default Features;
