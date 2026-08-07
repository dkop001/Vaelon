import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, X, BookOpen, Briefcase, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const TEMPLATES = [
  {
    id: "lecture",
    icon: BookOpen,
    label: "Lecture Notes",
    text: `Photosynthesis Overview
- Light-dependent reactions: occur in thylakoid membranes, produce ATP and NADPH
- Calvin cycle: occurs in stroma, fixes CO2 into glucose
- Key enzyme: RuBisCO (most abundant protein on Earth)
- C3 vs C4 plants: C4 has spatial separation to avoid photorespiration
- Factors affecting rate: light intensity, CO2 concentration, temperature`,
    preview: "Photosynthesis Overview - Light-dependent reactions...",
  },
  {
    id: "meeting",
    icon: Briefcase,
    label: "Meeting Notes",
    text: `Sprint Planning — Week 14
Date: Monday
Attendees: Alice, Bob, Carol, Dave

Agenda:
1. Review completed tickets (12/15 done)
2. Blockers: Auth module waiting on API review
3. Sprint goals: Ship payment flow, fix search pagination
4. Action items: Alice to finalise API docs, Bob to review PR #234

Decisions:
- Push payment flow to staging by Wednesday
- Defer dark mode to next sprint`,
    preview: "Sprint Planning — Week 14 - Review completed tickets...",
  },
  {
    id: "research",
    icon: FileText,
    label: "Research Paper",
    text: `Attention Is All You Need — Key Takeaways

Architecture: Transformer replaces RNNs with self-attention mechanism
- Encoder-decoder stack, 6 layers each
- Multi-head attention (8 heads) with scaled dot-product
- Positional encoding added to input embeddings

Key innovations:
1. Parallelisation: no sequential dependency (vs RNNs)
2. Long-range dependencies handled better than LSTMs
3. BLEU score 41.8 on EN-DE translation (new SOTA)

Impact: Foundation for BERT, GPT, and all modern LLMs`,
    preview: "Attention Is All You Need — Key Takeaways - Architecture...",
  },
];

const Confetti = () => {
  const colors = ["#7c3aed", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3000 }}>
      {Array.from({ length: 60 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 80 + Math.random() * 180;
        const xDir = Math.cos(angle) * velocity;
        const yDir = Math.sin(angle) * velocity;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: "50vw", y: "50vh", scale: Math.random() * 0.8 + 0.4 }}
            animate={{
              opacity: 0,
              x: `calc(50vw + ${xDir}px)`,
              y: `calc(50vh + ${yDir}px)`,
              rotate: Math.random() * 360,
            }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: Math.random() > 0.5 ? "10px" : "6px",
              height: Math.random() > 0.5 ? "10px" : "15px",
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            }}
          />
        );
      })}
    </div>
  );
};

const Onboarding = ({ step, updateStep, onComplete, isStreaming, summary }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.user_metadata?.onboarding_complete) {
      setDismissed(true);
    }
  }, [user]);

  const handleSkip = async () => {
    if (user) {
      await supabase.auth.updateUser({
        data: { onboarding_complete: true },
      });
    }
    setDismissed(true);
    if (onComplete) onComplete(null);
  };

  const handleSelectTemplate = (template) => {
    if (onComplete) onComplete(template);
    updateStep(3);
  };

  const handleGetStarted = () => {
    updateStep(2);
  };

  const handleNextStep = () => {
    updateStep(5);
  };

  const handleMarkComplete = async () => {
    setShowConfetti(true);
    if (user) {
      await supabase.auth.updateUser({
        data: { onboarding_complete: true },
      });
    }
    setTimeout(() => {
      setDismissed(true);
      if (onComplete) onComplete(null);
    }, 2000);
  };

  if (dismissed) return null;

  const stepTitle = (s) => {
    switch (s) {
      case 1: return "Welcome to note_ai";
      case 2: return "Pick a template to start";
      case 3: return "See the magic";
      case 4: return "Check your summary";
      case 5: return "You're all set!";
      default: return "";
    }
  };

  const isFloating = step === 3 || step === 4;

  return (
    <>
      {showConfetti && <Confetti />}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          backgroundColor: isFloating ? "transparent" : "rgba(0,0,0,0.6)",
          backdropFilter: isFloating ? "none" : "blur(8px)",
          WebkitBackdropFilter: isFloating ? "none" : "blur(8px)",
          pointerEvents: isFloating ? "none" : "auto",
          display: "flex",
          alignItems: isFloating ? "flex-end" : "center",
          justifyContent: "center",
          padding: "1rem",
          overflowY: "auto",
        }}
      >
        <motion.div
          initial={isFloating ? { y: 100, opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="premium-card"
          style={{
            width: "100%",
            maxWidth: step === 4 ? "620px" : "560px",
            padding: "1.75rem",
            position: "relative",
            backgroundColor: "var(--bg-primary)",
            pointerEvents: "auto",
            boxShadow: "var(--shadow-premium)",
            border: "1px solid var(--border-color)",
            marginBottom: isFloating ? "1.5rem" : "0",
          }}
        >
          <button
            onClick={handleSkip}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              color: "var(--text-tertiary)",
              padding: "0.375rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "32px",
              minWidth: "32px",
              zIndex: 10,
            }}
            aria-label="Skip"
          >
            <X size={20} />
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                backgroundColor: "var(--border-color)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(step / 5) * 100}%`,
                  height: "100%",
                  borderRadius: "2px",
                  backgroundColor: "var(--accent-primary)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Step {step} of 5
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ textAlign: "center" }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "var(--radius-md)",
                    background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                    color: "white",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <Sparkles size={26} />
                </div>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    marginBottom: "0.5rem",
                  }}
                >
                  {stepTitle(step)}
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.6,
                    marginBottom: "1.5rem",
                  }}
                >
                  Turn your chaos into clarity. Paste notes, upload files, and get AI-powered summaries in seconds.
                </p>
                <button className="btn-primary" onClick={handleGetStarted} style={{ width: "100%" }}>
                  Get started <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    marginBottom: "0.375rem",
                  }}
                >
                  {stepTitle(step)}
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  Choose a template to see note_ai in action, or skip to paste your own notes.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      style={{
                        width: "100%",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-secondary)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "var(--transition)",
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                      }}
                      className="hover-bg"
                    >
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          minWidth: "38px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "hsla(262,80%,60%,0.1)",
                          border: "1px solid hsla(262,80%,60%,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent-primary)",
                        }}
                      >
                        <t.icon size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
                          {t.label}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-tertiary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.preview}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleSelectTemplate(null)}
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  Skip — I'll paste my own notes
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <Sparkles size={20} style={{ color: "var(--accent-primary)" }} />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {stepTitle(step)}
                  </h3>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "1rem" }}>
                  The template text has been loaded into your workspace! Click the pulsating <strong>Summarize</strong> button to process it and generate a summary.
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={handleSkip} className="btn-secondary" style={{ flex: 1, minHeight: "38px" }}>
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <Sparkles size={20} style={{ color: "var(--accent-primary)" }} />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {stepTitle(step)}
                  </h3>
                </div>
                {isStreaming ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                    Streaming your summary now. Watch the AI extract the key points in real-time...
                  </p>
                ) : (
                  <>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "1rem" }}>
                      Awesome! Your summary is ready. Check out these actions in the top-right toolbar:
                    </p>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-secondary)",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "1rem",
                      border: "1px solid var(--border-color)"
                    }}>
                      <div>📋 <strong>Copy</strong>: Click to copy text</div>
                      <div>🎧 <strong>Listen</strong>: Generate TTS audio</div>
                      <div>📄 <strong>PDF</strong>: Download formatted PDF</div>
                      <div>🧠 <strong>Quiz</strong>: Auto-generate study quiz</div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={handleNextStep} className="btn-primary" style={{ flex: 1, minHeight: "38px" }}>
                        Awesome, Next <ArrowRight size={15} />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ textAlign: "center" }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "var(--radius-md)",
                    background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                    color: "white",
                  }}
                >
                  <Sparkles size={26} />
                </div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Onboarding Complete!
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.6,
                    marginBottom: "1.5rem",
                  }}
                >
                  You are all set to use note_ai to organize, summarize, and master your learning material.
                </p>
                <button className="btn-primary" onClick={handleMarkComplete} style={{ width: "100%" }}>
                  Start using note_ai <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
};

export default Onboarding;
