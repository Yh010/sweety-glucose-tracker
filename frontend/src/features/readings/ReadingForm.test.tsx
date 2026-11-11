import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingForm } from './ReadingForm';
import { ApiError } from '../../lib/api';
const defaults = {
  today: '2026-11-11',
  defaultDate: '2026-11-11',
  selectedSlot: 'fasting' as const,
  editing: null,
  pending: false,
  error: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};
beforeEach(() => vi.clearAllMocks());
it('explains an empty glucose value without submitting', async () => {
  render(<ReadingForm {...defaults} />);
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please enter a glucose value.');
  expect(defaults.onSave).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Glucose value')).toHaveFocus();
});
it.each(['39', '601', '100.5'])('rejects invalid value %s', async (value) => {
  render(<ReadingForm {...defaults} />);
  await userEvent.type(screen.getByLabelText('Glucose value'), value);
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(screen.getByRole('alert')).toHaveTextContent('whole number between 40 and 600');
  expect(defaults.onSave).not.toHaveBeenCalled();
});
it('submits a numeric value with the chosen date and slot', async () => {
  render(<ReadingForm {...defaults} />);
  await userEvent.type(screen.getByLabelText('Glucose value'), '110');
  await userEvent.selectOptions(screen.getByLabelText('Time slot'), 'after_lunch');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(defaults.onSave).toHaveBeenCalledWith({
    date: '2026-11-11',
    slot: 'after_lunch',
    value: 110,
  });
});
it('shows server conflicts and preserves the entry for correction', () => {
  render(
    <ReadingForm
      {...defaults}
      editing={{ id: 'abc', date: '2026-11-10', slot: 'after_lunch', value: 130 }}
      error={
        new ApiError(
          409,
          'DUPLICATE_SLOT',
          'You already have an After lunch reading for this date.',
        )
      }
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('already have');
  expect(screen.getByLabelText('Glucose value')).toHaveValue(130);
});
it('disables changes while saving and offers cancellation when editing', async () => {
  const { rerender } = render(<ReadingForm {...defaults} pending />);
  expect(screen.getByLabelText('Glucose value')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  rerender(
    <ReadingForm
      {...defaults}
      editing={{ id: 'abc', date: '2026-11-10', slot: 'fasting', value: 100 }}
    />,
  );
  await userEvent.click(screen.getByText('Cancel editing', { exact: true }));
  expect(defaults.onCancel).toHaveBeenCalledOnce();
});
