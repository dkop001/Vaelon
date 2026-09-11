import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { GlassInput, GlassTextarea } from './GlassInput';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'workspace' | 'project' | 'identity' | 'first-question';

const STEPS: Step[] = ['welcome', 'workspace', 'project', 'identity', 'first-question'];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [workspacePath, setWorkspacePath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [mission, setMission] = useState('');
  const [techStack, setTechStack] = useState('');
  const [firstQuestion, setFirstQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createWorkspace, createProject, selectWorkspace, selectProject } = useWorkspaceStore();
  const { setOnboardingComplete, setActiveMode } = useAppStore();

  const stepIndex = STEPS.indexOf(currentStep);
  const totalSteps = STEPS.length;

  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const handleNext = async () => {
    if (currentStep === 'workspace') {
      if (!workspaceName.trim()) return;
      setIsSubmitting(true);
      try {
        await createWorkspace(workspaceName, workspacePath || `/${workspaceName.toLowerCase().replace(/\s+/g, '-')}`);
        const { workspaces } = useWorkspaceStore.getState();
        if (workspaces.length > 0) {
          await selectWorkspace(workspaces[0].id);
        }
      } catch (err) {
        console.error('Failed to create workspace:', err);
      }
      setIsSubmitting(false);
    }

    if (currentStep === 'project') {
      if (!projectName.trim()) return;
      setIsSubmitting(true);
      try {
        await createProject(projectName, projectDescription);
        const { projects } = useWorkspaceStore.getState();
        if (projects.length > 0) {
          await selectProject(projects[0].id);
        }
      } catch (err) {
        console.error('Failed to create project:', err);
      }
      setIsSubmitting(false);
    }

    if (currentStep === 'first-question') {
      handleComplete();
      return;
    }

    const nextIndex = Math.min(stepIndex + 1, totalSteps - 1);
    goToStep(STEPS[nextIndex]);
  };

  const handleBack = () => {
    const prevIndex = Math.max(stepIndex - 1, 0);
    goToStep(STEPS[prevIndex]);
  };

  const handleSkip = () => {
    if (currentStep === 'identity') {
      goToStep('first-question');
    }
  };

  const handleComplete = () => {
    setOnboardingComplete();
    if (firstQuestion.trim()) {
      setActiveMode('agent');
      // The agent will be started with this question
    }
    onComplete();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'radial-gradient(circle, hsla(211,100%,60%,0.2) 0%, transparent 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'welcome-fade 0.6s ease both',
            }}>
              <svg width="40" height="40" viewBox="0 0 16 16" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(41,151,255,0.4))' }}>
                <path d="M 3.5 4.2 L 8 12 L 12.5 4.2" stroke="#2997FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--tx-primary)', margin: 0, letterSpacing: '-.03em' }}>
                Welcome to Vaelon
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)', marginTop: 8, maxWidth: 320, lineHeight: 1.6 }}>
                Your developer operating system. Let's set up your workspace in a few quick steps.
              </p>
            </div>
          </div>
        );

      case 'workspace':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--tx-primary)', margin: 0 }}>
                Create a Workspace
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)', marginTop: 6 }}>
                A workspace holds your projects and memories.
              </p>
            </div>
            <GlassInput
              label="Workspace Name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Workspace"
            />
            <GlassInput
              label="Folder Path (optional)"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/Users/you/projects"
            />
          </div>
        );

      case 'project':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--tx-primary)', margin: 0 }}>
                Create a Project
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)', marginTop: 6 }}>
                Projects organize your documents, research, and tasks.
              </p>
            </div>
            <GlassInput
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Project"
            />
            <GlassTextarea
              label="Description (optional)"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>
        );

      case 'identity':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--tx-primary)', margin: 0 }}>
                Project Identity
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)', marginTop: 6 }}>
                Help the agent understand your project better. You can skip this.
              </p>
            </div>
            <GlassTextarea
              label="Mission Statement"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="What is the goal of this project?"
              rows={3}
            />
            <GlassInput
              label="Tech Stack"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="React, TypeScript, Rust..."
            />
          </div>
        );

      case 'first-question':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--tx-primary)', margin: 0 }}>
                Ask Your Agent
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)', marginTop: 6 }}>
                What would you like help with? The agent will use your project context.
              </p>
            </div>
            <GlassTextarea
              label="Your Question"
              value={firstQuestion}
              onChange={(e) => setFirstQuestion(e.target.value)}
              placeholder="e.g., Set up the project structure, create a README, analyze the codebase..."
              rows={4}
            />
          </div>
        );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        padding: '0 24px',
      }}>
        <div className="glass" style={{
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-10)',
          background: 'var(--glass-bg-medium)',
          backdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-saturate))',
          WebkitBackdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-saturate))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow-lg)',
          animation: 'welcome-fade 0.4s ease both',
        }}>
          {renderStep()}

          {/* Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 32,
            paddingTop: 20,
            borderTop: '1px solid var(--border-subtle)',
          }}>
            {/* Back button */}
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--tx-tertiary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all var(--t-fast)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--tx-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--tx-tertiary)'}
              >
                Back
              </button>
            )}

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
              {STEPS.map((step, i) => (
                <div
                  key={step}
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === stepIndex ? 'var(--accent)' : i < stepIndex ? 'var(--accent-muted)' : 'var(--border)',
                    transition: 'all var(--t-base)',
                  }}
                />
              ))}
            </div>

            {/* Next/Skip buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {currentStep === 'identity' && (
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tx-tertiary)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isSubmitting || (currentStep === 'workspace' && !workspaceName.trim()) || (currentStep === 'project' && !projectName.trim())}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--tx-inverse)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '10px 24px',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.6 : 1,
                  transition: 'all var(--t-fast)',
                }}
              >
                {currentStep === 'first-question' ? (firstQuestion.trim() ? 'Ask Agent' : 'Skip for Now') : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}