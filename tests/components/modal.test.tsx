import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Modal } from '../../src/components/common/Modal';

/**
 * A dialog that behaves like the real ones: the parent recreates the
 * `onClose` callback on every render.
 */
function Host({ onReady }: { onReady?: (value: string) => void }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal
        open={open}
        title="Nueva presentación"
        onClose={() => setOpen(false)}
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        }
      >
        <label htmlFor="campo">Nombre</label>
        <input
          id="campo"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onReady?.(event.target.value);
          }}
        />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('no roba el foco mientras se escribe', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<Host onReady={(value) => seen.push(value)} />);

    const input = screen.getByLabelText('Nombre') as HTMLInputElement;

    // Al abrirse, el foco está en el campo para poder escribir directamente.
    expect(document.activeElement).toBe(input);

    await user.type(input, 'Mimos de Francia');

    // Se escribe todo el texto y el foco sigue en el campo.
    expect(input.value).toBe('Mimos de Francia');
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe('Mimos de Francia');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe('Mimos de Francia'.length);
  });

  it('se cierra con la tecla Escape', async () => {
    const user = userEvent.setup();
    render(<Host />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cierra al pulsar fuera', async () => {
    const user = userEvent.setup();
    const { container } = render(<Host />);

    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('devuelve el foco al elemento anterior al cerrarse', async () => {
    const user = userEvent.setup();
    render(<Host />);

    const input = screen.getByLabelText('Nombre') as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(document.body);
  });

  it('no llama a onClose más de una vez por pulsación de Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    function Wrapper() {
      const [open, setOpen] = useState(true);
      return (
        <Modal
          open={open}
          title="Diálogo"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <input aria-label="Campo" />
        </Modal>
      );
    }

    render(<Wrapper />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
