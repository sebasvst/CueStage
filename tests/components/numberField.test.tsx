import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from '../../src/components/common/NumberField';

describe('NumberField', () => {
  it('permite escribir decimales sin perder el punto', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberField value={0} min={0} max={30} step={0.1} onChange={onChange} ariaLabel="Fundido" />,
    );

    const input = screen.getByLabelText('Fundido') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '0.6');

    // El texto conserva el punto decimal.
    expect(input.value).toBe('0.6');
    expect(onChange).toHaveBeenLastCalledWith(0.6);
  });

  it('acepta un valor con decimales que empieza por cero', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField value={1} min={0} max={30} onChange={onChange} ariaLabel="Campo" />);

    const input = screen.getByLabelText('Campo') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '0.25');

    expect(input.value).toBe('0.25');
    expect(onChange).toHaveBeenLastCalledWith(0.25);
  });

  it('mantiene el valor anterior si se deja el campo vacío', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField value={1.5} min={0} max={30} onChange={onChange} ariaLabel="Campo" />);

    const input = screen.getByLabelText('Campo') as HTMLInputElement;
    await user.clear(input);
    await user.tab();

    expect(input.value).toBe('1.5');
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it('limita el valor al máximo y al mínimo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField value={0} min={0} max={30} onChange={onChange} ariaLabel="Campo" />);

    const input = screen.getByLabelText('Campo') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '99');
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(30);
    expect(input.value).toBe('30');
  });

  it('refleja el valor que llega desde fuera', () => {
    const { rerender } = render(
      <NumberField value={1} min={0} max={30} onChange={() => undefined} ariaLabel="Campo" />,
    );
    const input = screen.getByLabelText('Campo') as HTMLInputElement;
    expect(input.value).toBe('1');

    rerender(
      <NumberField value={2.5} min={0} max={30} onChange={() => undefined} ariaLabel="Campo" />,
    );
    expect(input.value).toBe('2.5');
  });
});
