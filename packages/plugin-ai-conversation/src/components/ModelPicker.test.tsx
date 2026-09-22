import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';

import { ModelPicker } from './ModelPicker';

const MODELS = [
  { model_name: 'team/alpha', mode: 'chat' },
  { model_name: 'team/beta', mode: 'chat' },
  { model_name: 'other/gamma', mode: 'chat' },
];

function renderPicker(
  value: string,
  props: Partial<React.ComponentProps<typeof ModelPicker>> = {},
) {
  const onChange = jest.fn();
  const listModels = jest.fn().mockResolvedValue(MODELS);
  render(
    <TestApiProvider apis={[[liteLlmApiRef, { listModels } as any]]}>
      <ModelPicker value={value} onChange={onChange} {...props} />
    </TestApiProvider>,
  );
  return { onChange };
}

describe('ModelPicker', () => {
  it('narrows the options to the selected team allowlist', async () => {
    renderPicker('team/alpha', { teamModels: ['team/alpha', 'team/beta'] });

    const input = await screen.findByRole('combobox', { name: 'Model' });
    fireEvent.mouseDown(input);

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('team/alpha')).toBeTruthy();
    expect(within(listbox).getByText('team/beta')).toBeTruthy();
    expect(within(listbox).queryByText('other/gamma')).toBeNull();
  });

  it('does not commit partial text while the user is typing', async () => {
    const { onChange } = renderPicker('team/alpha', {
      teamModels: ['team/alpha', 'team/beta'],
    });

    const input = await screen.findByRole('combobox', { name: 'Model' });
    fireEvent.change(input, { target: { value: 'tea' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits the model name when an option is chosen', async () => {
    const { onChange } = renderPicker('team/alpha', {
      teamModels: ['team/alpha', 'team/beta'],
    });

    const input = await screen.findByRole('combobox', { name: 'Model' });
    fireEvent.mouseDown(input);
    fireEvent.click(await screen.findByText('team/beta'));

    expect(onChange).toHaveBeenCalledWith('team/beta');
  });

  it('clears a value the newly selected team cannot call', async () => {
    const { onChange } = renderPicker('other/gamma', {
      teamModels: ['team/alpha'],
    });

    await screen.findByRole('combobox', { name: 'Model' });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
  });

  it('selects a team-allowed default when nothing is picked', async () => {
    const { onChange } = renderPicker('', {
      defaultModel: 'team/beta',
      teamModels: ['team/alpha', 'team/beta'],
    });

    await screen.findByRole('combobox', { name: 'Model' });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('team/beta'));
  });
});
