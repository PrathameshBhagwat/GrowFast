import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface WizardStep {
  title: string;
  description?: string;
}

export interface WizardShellProps {
  steps: WizardStep[];
  currentStep: number;
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  nextLabel?: string;
  completeLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}

/**
 * WizardShell — multi-step wizard container with step indicator and navigation.
 * Used for order creation and other multi-step flows.
 */
export const WizardShell: React.FC<WizardShellProps> = ({
  steps,
  currentStep,
  onBack,
  onNext,
  onComplete,
  nextLabel = 'Next',
  completeLabel = 'Complete',
  nextDisabled = false,
  children,
}) => {
  const isLastStep = currentStep === steps.length - 1;
  const currentStepInfo = steps[currentStep];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: "'Inter', sans-serif",
        background: 'var(--bg-app)',
      }}
    >
      {/* Step indicator */}
      <div
        style={{
          margin: '16px 20px 0 20px',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-neu-card-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background:
                    i <= currentStep
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : 'var(--bg-surface-inset)',
                  border: i <= currentStep ? '1px solid #2563eb' : '1px solid var(--border)',
                  boxShadow: i <= currentStep ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none',
                  color: i <= currentStep ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 300ms ease',
                }}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: i < currentStep ? '#2563eb' : 'var(--border)',
                    borderRadius: '1px',
                    transition: 'background 300ms ease',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        {currentStepInfo && (
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {currentStepInfo.title}
            </h3>
            {currentStepInfo.description && (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.84rem',
                  color: 'var(--text-muted)',
                }}
              >
                {currentStepInfo.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>{children}</div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 20px 16px 20px',
          padding: '12px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-neu-card-sm)',
        }}
      >
        <Button
          variant="ghost"
          size="md"
          onClick={onBack}
          disabled={currentStep === 0}
          icon={<ChevronLeft size={16} />}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={isLastStep ? onComplete : onNext}
          disabled={nextDisabled}
          icon={isLastStep ? undefined : <ChevronRight size={16} />}
        >
          {isLastStep ? completeLabel : nextLabel}
        </Button>
      </div>
    </div>
  );
};
