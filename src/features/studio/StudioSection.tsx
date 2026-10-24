import { useEffect, useState } from 'react';
import {
  Copy,
  FileMusic,
  LoaderCircle,
  Radio,
  Save,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { EmptyState } from '../../components/common/Controls';
import { Modal } from '../../components/common/Modal';
import { LibraryPanel } from '../library/LibraryPanel';
import { CueEditor } from './CueEditor';
import { PadEditor } from './PadEditor';
import { MixerSettings, MusicSettings } from './ProjectSettingsPanel';
import { ShortcutEditor } from './ShortcutEditor';
import { OnboardingGuide } from '../tutorial/OnboardingGuide';
import { audioController } from '../live-mode/audioController';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import type { ReactNode } from 'react';

export function StudioSection() {
  const project = useProjectStore((state) => state.project);
  const save = useProjectStore((state) => state.save);
  const saveAs = useProjectStore((state) => state.saveAs);
  const dirty = useProjectStore((state) => state.dirty);
  const saving = useProjectStore((state) => state.saving);
  const setSection = useUiStore((state) => state.setSection);
  const pushToast = useUiStore((state) => state.pushToast);
  const preparing = useAudioStore((state) => state.preparing);
  const preparation = useAudioStore((state) => state.preparation);
  const showTutorial = useSettingsStore((state) => state.settings.showTutorial);
  const patch = useSettingsStore((state) => state.patch);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const mixer = project?.mixer;

  useEffect(() => {
    if (mixer) audioController.applyMixer(mixer);
  }, [mixer]);

  useEffect(() => {
    const goLive = () => setSection('en-vivo');
    window.addEventListener('cuestage:go-live', goLive);
    return () => window.removeEventListener('cuestage:go-live', goLive);
  }, [setSection]);

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon={<FileMusic size={22} />}
          title="No hay ninguna presentación abierta"
          description="Crea una presentación o abre una que ya tengas para empezar a preparar la música y los sonidos."
          actions={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setSection('inicio')}
            >
              Volver a Proyectos
            </button>
          }
        />
      </div>
    );
  }

  const preparedCount = Object.values(preparation).filter(
    (entry) => entry.state === 'ready',
  ).length;
  const errorCount = Object.values(preparation).filter(
    (entry) => entry.state === 'error',
  ).length;

  const handlePrepare = async () => {
    await audioController.ensureRunning();
    const result = await audioController.prepareAll();
    if (result.failed > 0) {
      pushToast(
        `${result.prepared} archivo(s) preparados, ${result.failed} con errores.`,
        'warning',
      );
    } else {
      pushToast(`${result.prepared} archivo(s) listos para actuar.`, 'success');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <span className="page-eyebrow">Preparar</span>
          <h1>{project.name}</h1>
          <p className="page-subtitle">
            Tres pasos, en orden. No hace falta que sepas nada de sonido: elige la música,
            crea los botones que lanzarás en escena y escribe la lista de señales.
          </p>
        </div>
        <div className="page-actions">
          <span className="badge">
            {saving ? 'Guardando…' : dirty ? 'Cambios sin guardar' : 'Todo guardado'}
          </span>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void handlePrepare()}
            disabled={preparing}
          >
            {preparing ? (
              <LoaderCircle size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Preparar el sonido
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => void save()}>
            <Save size={16} />
            Guardar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setSaveAsName(project.name);
              setSaveAsOpen(true);
            }}
            title="Crea una copia independiente de esta presentación"
          >
            <Copy size={16} />
            Guardar como
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setSection('en-vivo')}
          >
            <Radio size={16} />
            Ir a En vivo
          </button>
        </div>
      </header>

      {showTutorial ? (
        <OnboardingGuide
          project={project}
          onDismiss={() => patch({ showTutorial: false })}
        />
      ) : null}

      <div className="steps">
        <Step
          id="tutorial-musica"
          number={1}
          title="La música de fondo"
          hint="Elige la pista que sonará durante toda la actuación."
        >
          <MusicSettings />
        </Step>

        <Step
          id="tutorial-botones"
          number={2}
          title="Los sonidos de la escena"
          hint="Cada archivo tiene su propio botón. Solo tienes que ponerles un nombre claro y, si quieres, una tecla para lanzarlos sin mirar."
        >
          <div className="studio-layout">
            <div id="tutorial-archivos">
              <LibraryPanel />
            </div>
            <PadEditor />
          </div>
        </Step>

        <Step
          id="tutorial-lista"
          number={3}
          title="La lista de señales"
          hint="Escribe lo que va pasando en escena, en orden. En «En vivo» la recorrerás con un solo toque."
        >
          <CueEditor />
        </Step>
      </div>

      <div className="collapsible" style={{ marginTop: 'var(--space-8)' }}>
        <button
          type="button"
          className="collapsible__summary"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <span>Más opciones (volúmenes y teclado)</span>
          <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
        </button>
        {moreOpen ? (
          <div className="collapsible__body">
            <div className="stack" style={{ gap: 'var(--space-5)' }}>
              <MixerSettings />
              <ShortcutEditor />
            </div>
          </div>
        ) : null}
      </div>

      <div className="action-bar">
        <span className="action-bar__status">
          <Volume2 size={15} />
          {preparedCount > 0
            ? `${preparedCount} archivo(s) listos para tocar`
            : errorCount > 0
              ? `${errorCount} archivo(s) no se han podido preparar`
              : 'Pulsa «Preparar el sonido» antes de actuar'}
        </span>
        <span className="row" style={{ gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn--secondary" onClick={() => void save()}>
            <Save size={16} />
            Guardar
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setSaveAsName(project.name);
              setSaveAsOpen(true);
            }}
          >
            <Copy size={16} />
            Guardar como
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => setSection('en-vivo')}
          >
            <Radio size={17} />
            Ir a En vivo
          </button>
        </span>
      </div>

      <Modal
        open={saveAsOpen}
        title="Guardar como"
        description="Se crea una copia independiente, con sus propios archivos. La presentación actual no cambia."
        onClose={() => setSaveAsOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSaveAsOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saveAsName.trim().length === 0}
              onClick={() => {
                const name = saveAsName.trim();
                setSaveAsOpen(false);
                void saveAs(name);
                pushToast('Copia guardada. Ahora estás preparando la copia.', 'success');
              }}
            >
              <Copy size={16} />
              Guardar la copia
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="save-as-name">
            Nombre de la copia
          </label>
          <input
            id="save-as-name"
            className="input"
            value={saveAsName}
            maxLength={120}
            onChange={(event) => setSaveAsName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && saveAsName.trim()) {
                const name = saveAsName.trim();
                setSaveAsOpen(false);
                void saveAs(name);
              }
            }}
          />
          <span className="field__hint">
            Los archivos de audio se copian también, así que la copia funciona por
            separado.
          </span>
        </div>
      </Modal>
    </div>
  );
}

function Step({
  id,
  number,
  title,
  hint,
  children,
}: {
  id: string;
  number: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="step" id={id}>
      <span className="step__number" aria-hidden="true">
        {number}
      </span>
      <div className="step__body">
        <div className="step__head">
          <h2 className="step__title">{title}</h2>
          <span className="step__hint">{hint}</span>
        </div>
        {children}
      </div>
    </section>
  );
}
