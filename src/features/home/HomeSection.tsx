import { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Radio,
  Sparkles,
  Volume2,
  Folder,
  HardDrive,
} from 'lucide-react';
import { EmptyState } from '../../components/common/Controls';
import { CueStageMark } from '../../components/common/Icon';
import { NewProjectDialog } from '../../components/ProjectDialog/NewProjectDialog';
import { OpenProjectDialog } from '../../components/ProjectDialog/OpenProjectDialog';
import { DeleteProjectButton } from '../../components/ProjectDialog/DeleteProjectButton';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { formatRelativeDate } from '../../utils/format';
import { isTauri } from '../../services/bridge';

export function HomeSection() {
  const project = useProjectStore((state) => state.project);
  const recentProjects = useProjectStore((state) => state.recentProjects);
  const refreshRecent = useProjectStore((state) => state.refreshRecent);
  const createProject = useProjectStore((state) => state.createProject);
  const openProject = useProjectStore((state) => state.openProject);
  const dirty = useProjectStore((state) => state.dirty);
  const setSection = useUiStore((state) => state.setSection);
  const pushToast = useUiStore((state) => state.pushToast);

  const engineStatus = useAudioStore((state) => state.status);
  const engineError = useAudioStore((state) => state.error);

  const [newOpen, setNewOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const handleCreate = async (name: string) => {
    setBusy(true);
    try {
      await createProject(name);
      setNewOpen(false);
      setSection('estudio');
      pushToast('Presentación creada. Añade la música y los sonidos.', 'success');
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo crear la presentación.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const runOpen = async (id: string) => {
    setBusy(true);
    try {
      const ok = await openProject(id);
      if (ok) {
        setOpenOpen(false);
        setSection('estudio');
        pushToast('Presentación abierta.', 'success');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (id: string) => {
    if (dirty && project) {
      setPendingOpenId(id);
      return;
    }
    await runOpen(id);
  };

  return (
    <div className="page">
      <section className="home-hero">
        <span className="home-hero__eyebrow">
          <CueStageMark size={13} /> CueStage
        </span>
        <h1 className="home-hero__title">Prepara tu presentación y actúala con un clic.</h1>
        <p className="home-hero__text">
          CueStage pone la música de fondo y te deja lanzar los sonidos justo en el
          momento en que hacen falta. Todo se guarda en este equipo y funciona sin
          internet.
        </p>

        {project ? (
          <div className="home-hero__actions">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => setSection('en-vivo')}
            >
              <Radio size={17} />
              Ir a En vivo
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => setSection('estudio')}
            >
              Seguir preparando
            </button>
          </div>
        ) : null}
      </section>

      {recentProjects.length === 0 && !project ? (
        <section className="welcome" style={{ marginTop: 'var(--space-6)' }}>
          <div className="welcome__item">
            <span className="welcome__number">1</span>
            <span className="welcome__title">Añade tus archivos</span>
            <span className="welcome__text">
              Arrastra la música y los sonidos de la función. Se copian dentro de la
              presentación y tus originales no se tocan.
            </span>
          </div>
          <div className="welcome__item">
            <span className="welcome__number">2</span>
            <span className="welcome__title">Renombra los botones</span>
            <span className="welcome__text">
              Cada archivo recibe un botón automáticamente. Ponle un nombre claro y, si
              quieres, una tecla para lanzarlo sin mirar.
            </span>
          </div>
          <div className="welcome__item">
            <span className="welcome__number">3</span>
            <span className="welcome__title">Actúa</span>
            <span className="welcome__text">
              En «En vivo» solo tienes que tocar el botón del sonido que suene en ese
              momento. Un botón rojo para pararlo todo.
            </span>
          </div>
          <div className="welcome__action">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => void handleCreate('Mi presentación')}
            >
              <Sparkles size={17} />
              Empezar ahora
            </button>
            <span className="field__hint">
              Se abrirá la guía para que te acompañe paso a paso.
            </span>
          </div>
        </section>
      ) : null}

      <div className="choice-grid" style={{ marginTop: 'var(--space-6)' }}>
        <button
          type="button"
          className="choice-card choice-card--primary"
          onClick={() => setNewOpen(true)}
        >
          <span className="choice-card__icon">
            <Plus size={20} />
          </span>
          <span className="choice-card__title">Crear una presentación</span>
          <span className="choice-card__text">
            Empieza de cero. Después añadirás la música y los sonidos que necesites.
          </span>
        </button>

        <button type="button" className="choice-card" onClick={() => setOpenOpen(true)}>
          <span className="choice-card__icon">
            <FolderOpen size={20} />
          </span>
          <span className="choice-card__title">Abrir una presentación</span>
          <span className="choice-card__text">
            Continúa con una que ya tenías preparada en este equipo.
          </span>
        </button>
      </div>

      <section className="card" style={{ marginTop: 'var(--space-6)' }}>
        <div className="card__header">
          <div className="card__heading">
            <h2 className="card__title">Tus presentaciones</h2>
            <p className="card__description">
              {recentProjects.length === 0
                ? 'Aquí aparecerán las presentaciones que crees.'
                : 'Toca una para abrirla y seguir preparando.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void refreshRecent()}
          >
            Actualizar
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <EmptyState
            icon={<Folder size={22} />}
            title="Todavía no hay ninguna presentación"
            description="Crea la primera con el botón de arriba. Tardarás un minuto en tenerla lista."
          />
        ) : (
          <div className="recent-list">
            {recentProjects.map((item) => (
              <div key={item.id} className="recent-item">
                <button
                  type="button"
                  className="recent-item__main"
                  onClick={() => void handleOpen(item.id)}
                >
                  <span className="recent-item__icon">
                    <Folder size={18} />
                  </span>
                  <span className="recent-item__body">
                    <span className="recent-item__name">{item.name}</span>
                    <span className="recent-item__meta">
                      {formatRelativeDate(item.updatedAt)} · {item.padCount}{' '}
                      {item.padCount === 1 ? 'sonido' : 'sonidos'} · {item.assetCount}{' '}
                      {item.assetCount === 1 ? 'archivo' : 'archivos'}
                    </span>
                  </span>
                </button>
                <DeleteProjectButton project={item} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="notice" style={{ marginTop: 'var(--space-6)' }}>
        <Volume2 size={16} className="notice__icon" />
        <span>
          {engineStatus === 'ready'
            ? 'El sonido está listo. En cuanto pulses un botón se oirá.'
            : engineStatus === 'suspended'
              ? 'El motor de sonido está en pausa: pulsa cualquier botón para activarlo.'
              : engineStatus === 'error'
                ? (engineError?.message ?? 'El motor de sonido no ha podido arrancar.')
                : 'Activando el motor de sonido…'}
        </span>
      </div>

      <p className="field__hint" style={{ marginTop: 'var(--space-4)' }}>
        <HardDrive size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        {isTauri()
          ? 'Las presentaciones se guardan en este equipo, dentro de la carpeta de la aplicación.'
          : 'Estás en el navegador: las presentaciones se guardan solo en este navegador.'}
      </p>

      <NewProjectDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={handleCreate}
        busy={busy}
      />
      <OpenProjectDialog
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        projects={recentProjects}
        onOpen={handleOpen}
        busy={busy}
      />
      <DiscardChangesDialog
        open={pendingOpenId !== null}
        onCancel={() => setPendingOpenId(null)}
        onConfirm={async () => {
          const id = pendingOpenId;
          setPendingOpenId(null);
          if (id) await runOpen(id);
        }}
      />
    </div>
  );
}

function DiscardChangesDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Cambios sin guardar">
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Hay cambios sin guardar</h2>
            <p className="modal__description">
              La presentación actual se guardará antes de abrir la otra.
            </p>
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Guardar y abrir
          </button>
        </div>
      </div>
    </div>
  );
}
