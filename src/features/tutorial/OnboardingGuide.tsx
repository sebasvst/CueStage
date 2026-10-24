import { Check, Sparkles } from 'lucide-react';
import { requestFileImport } from '../library/importRequest';
import { resolveTutorialSteps } from './tutorialSteps';
import type { CueStageProject } from '../../types';

interface OnboardingGuideProps {
  project: CueStageProject | null;
  onDismiss: () => void;
}

/**
 * Mini tutorial shown while the presentation is being prepared.
 *
 * It reads the state of the project and always points to the next thing that
 * is missing, so it advances by itself as the user works.
 */
export function OnboardingGuide({ project, onDismiss }: OnboardingGuideProps) {
  const steps = resolveTutorialSteps(project);
  const pending = steps.find((step) => !step.done);
  if (!pending) return null;

  const isReady = pending.id === 'listo';

  const handleAction = () => {
    if (pending.id === 'archivos') {
      requestFileImport();
      return;
    }
    if (pending.id === 'listo') {
      window.dispatchEvent(new CustomEvent('cuestage:go-live'));
      return;
    }
    document
      .getElementById(pending.targetId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="guide" data-ready={isReady}>
      <div className="guide__icon" aria-hidden="true">
        {isReady ? <Check size={20} /> : <Sparkles size={20} />}
      </div>

      <div className="guide__body">
        <div className="guide__head">
          <span className="guide__badge">
            {isReady ? 'Listo' : `Paso ${pending.index} de 4`}
          </span>
          <h2 className="guide__title">{pending.title}</h2>
        </div>
        <p className="guide__text">{pending.text}</p>
        <div className="guide__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={handleAction}>
            {pending.actionLabel}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
            Ocultar la guía
          </button>
        </div>
      </div>

      <ol className="guide__steps" aria-label="Progreso de la preparación">
        {steps.slice(0, 4).map((step) => (
          <li
            key={step.id}
            className="guide__step"
            data-done={step.done}
            data-current={step.id === pending.id}
            title={step.title}
          >
            <span className="guide__step-dot" aria-hidden="true" />
            <span className="visually-hidden">{step.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
