import { useState } from 'react';
import { Modal } from '../common/Modal';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
  busy?: boolean;
}

export function NewProjectDialog({
  open,
  onClose,
  onCreate,
  busy = false,
}: NewProjectDialogProps) {
  const [name, setName] = useState('');

  const close = () => {
    setName('');
    onClose();
  };

  const submit = async () => {
    const value = name.trim();
    if (!value) return;
    await onCreate(value);
    setName('');
  };

  return (
    <Modal
      open={open}
      title="Nueva presentación"
      description="Crea un proyecto vacío. Podrás importar la música y los efectos en el Estudio."
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void submit()}
            disabled={busy || name.trim().length === 0}
          >
            Crear proyecto
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="new-project-name">
          Nombre de la presentación
        </label>
        <input
          id="new-project-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="Por ejemplo: Mimos de Francia"
          autoFocus
          maxLength={120}
        />
        <span className="field__hint">
          El proyecto se guarda en la carpeta local de aplicaciones y puede abrirse más tarde.
        </span>
      </div>
    </Modal>
  );
}
