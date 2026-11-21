import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { dayOutput, entryOutput } from '../test/fixtures';
import { apiResponse, renderWithProviders } from '../test/render';
import Day from './Day';

const getDay = vi.hoisted(() => vi.fn());
const setNote = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/days/days', () => ({
  dayControllerGet: getDay,
  dayControllerSetNote: setNote,
}));
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/entries/entries', () => ({
  entryControllerUpdate: update,
  entryControllerRemove: remove,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn(),
  userControllerUpdateUser: vi.fn(),
}));

function renderDay() {
  return renderWithProviders(
    <Routes>
      <Route path="/history/:date" element={<Day />} />
    </Routes>,
    { route: '/history/2026-11-19' },
  );
}

describe('Day', () => {
  beforeEach(() => {
    localStorage.clear();
    [getDay, setNote, update, remove].forEach((m) => m.mockReset());
    getDay.mockResolvedValue(apiResponse(dayOutput()));
    update.mockResolvedValue(apiResponse(entryOutput()));
    remove.mockResolvedValue({ data: undefined, status: 204 });
  });

  test('shows the day, its entries and what was typed', async () => {
    renderDay();
    expect(
      await screen.findByRole('heading', { name: 'Day 37' }),
    ).toBeVisible();
    expect(screen.getByText('Thu, Nov 19 · ≈ 20 kcal')).toBeVisible();
    expect(screen.getByText('2 × 5 @ 80 kg')).toBeVisible();
    expect(screen.getByText('You typed: 2x5 @ 80kg squat')).toBeVisible();
    expect(getDay).toHaveBeenCalledWith('2026-11-19');
  });

  test('edits sets in the user’s unit and reloads the day', async () => {
    getDay.mockResolvedValue(
      apiResponse(
        dayOutput({
          entries: [
            entryOutput({
              weightUnit: 'lb',
              sets: [{ setIndex: 1, reps: 5, weightKg: 61.23, weight: 135 }],
            }),
          ],
        }),
      ),
    );
    renderDay();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Weight, set 1')).toHaveValue('135');
    await userEvent.clear(screen.getByLabelText('Reps, set 1'));
    await userEvent.type(screen.getByLabelText('Reps, set 1'), '6');
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));
    await userEvent.clear(screen.getByLabelText('Weight, set 2'));
    await userEvent.type(screen.getByLabelText('Weight, set 2'), '137,5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(update).toHaveBeenCalledWith(1, {
      unit: 'lb',
      sets: [
        { reps: 6, weight: 135 },
        { reps: 6, weight: 137.5 },
      ],
    });
    await waitFor(() => expect(getDay).toHaveBeenCalledTimes(2));
  });

  test('points at bad input instead of sending it', async () => {
    renderDay();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Reps, set 2'));
    await userEvent.type(screen.getByLabelText('Reps, set 2'), '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the highlighted fields.',
    );
    expect(screen.getByLabelText('Reps, set 2')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(update).not.toHaveBeenCalled();
  });

  test('clears a cardio field with null', async () => {
    getDay.mockResolvedValue(
      apiResponse(
        dayOutput({
          entries: [
            entryOutput({
              sets: [],
              durationMin: 10,
              speedKmh: 6,
              inclinePct: 2,
            }),
          ],
        }),
      ),
    );
    renderDay();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Incline (%)'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(update).toHaveBeenCalledWith(1, {
      durationMin: 10,
      distanceKm: null,
      speedKmh: 6,
      inclinePct: null,
    });
  });

  test('a rejected edit is explained', async () => {
    update.mockRejectedValue(new ApiError('Bad Request', 400));
    renderDay();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check the highlighted fields.',
    );
  });

  test('deletes an entry after confirming, then reloads', async () => {
    renderDay();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete' }),
    );
    expect(screen.getByText('Delete this entry?')).toBeVisible();
    expect(remove).not.toHaveBeenCalled();

    getDay.mockResolvedValue(
      apiResponse(dayOutput({ entries: [], dayNumber: null })),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(remove).toHaveBeenCalledWith(1);
    expect(
      await screen.findByText('Nothing logged on this day.'),
    ).toBeVisible();
  });

  test('adds a note; an empty note clears it', async () => {
    setNote.mockResolvedValue(apiResponse(dayOutput({ note: 'Felt strong' })));
    renderDay();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add note' }),
    );
    await userEvent.type(screen.getByRole('textbox'), '  Felt strong  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(setNote).toHaveBeenCalledWith('2026-11-19', { note: 'Felt strong' });
    expect(await screen.findByText('Felt strong')).toBeVisible();

    setNote.mockResolvedValue(apiResponse(dayOutput({ note: null })));
    await userEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(setNote).toHaveBeenLastCalledWith('2026-11-19', { note: null });
  });
});
