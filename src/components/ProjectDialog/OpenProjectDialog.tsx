import { FolderOpen } from 'lucide-react';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/Controls';
import { DeleteProjectButton } from './DeleteProjectButton';
import { formatRelativeDate } from '../../utils/format';
import type { ProjectSummary } from '../../types';

interface OpenProjectDialogProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  onOpen: (id: string) => Promise<void> | void;
  busy?: boolean;
}

export function OpenProjectDialog({
  open,
  onClose,
  projects,
  onOpen,
  busy = false,
}: OpenProjectDialogProps) {
  return (
    <Modal
      open={open}
      title="Abrir proyecto"
      description="Selecciona una presentación guardada en este equipo."
      onClose={onClose}
      wide
    >
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={22} />}
          title="No hay proyectos guardados"
          description="Crea una presentación nueva para empezar a preparar tu material."
        />
      ) : (
        <div className="recent-list">
          {projects.map((project) => (
            <div key={project.id} className="recent-item">
              <button
                type="button"
                className="recent-item__main"
                onClick={() => void onOpen(project.id)}
                disabled={busy}
              >
                <span className="recent-item__icon">
                  <FolderOpen size={18} />
                </span>
                <span className="recent-item__body">
                  <span className="recent-item__name">{project.name}</span>
                  <span className="recent-item__meta">
                    {formatRelativeDate(project.updatedAt)} · {project.padCount}{' '}
                    {project.padCount === 1 ? 'sonido' : 'sonidos'} ·{' '}
                    {project.assetCount}{' '}
                    {project.assetCount === 1 ? 'archivo' : 'archivos'}
                  </span>
                </span>
              </button>
              <DeleteProjectButton project={project} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
