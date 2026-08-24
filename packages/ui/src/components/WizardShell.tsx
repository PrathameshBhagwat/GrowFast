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
      }}
    >
      {/* Step indicator */}
      <div
        style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: i <= currentStep ? '#2563EB' : '#E2E8F0',
                  color: i <= currentStep ? '#FFFFFF' : '#64748B',
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
                    background: i < currentStep ? '#2563EB' : '#E2E8F0',
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
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
              {currentStepInfo.title}
            </h3>
            {currentStepInfo.description && (
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
                {currentStepInfo.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>{children}</div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          background: '#FFFFFF',
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
