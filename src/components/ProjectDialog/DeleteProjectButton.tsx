import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import type { ProjectSummary } from '../../types';

interface DeleteProjectButtonProps {
  project: ProjectSummary;
  onDeleted?: () => void;
}

/**
 * Deletes a presentation in two clicks.
 *
 * The files copied into the project are removed with it; the originals the
 * user imported from their own folders are never touched.
 */
export function DeleteProjectButton({
  project,
  onDeleted,
}: DeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = useProjectStore((state) => state.removeProject);
  const refreshRecent = useProjectStore((state) => state.refreshRecent);
  const pushToast = useUiStore((state) => state.pushToast);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await remove(project.id);
      await refreshRecent();
      setOpen(false);
      onDeleted?.();
      pushToast(`«${project.name}» se ha eliminado.`, 'success');
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo eliminar la presentación.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn recent-item__delete"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Eliminar ${project.name}`}
        title="Eliminar esta presentación"
      >
        <Trash2 size={16} />
      </button>

      <Modal
        open={open}
        title="Eliminar la presentación"
        description="Esta acción no se puede deshacer."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </>
        }
      >
        <p className="modal__description">
          Se eliminará «{project.name}» y los archivos de audio copiados en su carpeta. Los
          archivos originales de tu ordenador no se tocan.
        </p>
      </Modal>
    </>
  );
}
