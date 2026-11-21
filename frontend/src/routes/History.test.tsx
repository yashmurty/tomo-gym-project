import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiResponse, renderWithProviders } from '../test/render';
import { dayOutput, entryOutput } from '../test/fixtures';
import History from './History';

const list = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/days/days', () => ({ dayControllerList: list }));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn(),
  userControllerUpdateUser: vi.fn(),
}));

const bench = entryOutput({
  id: 2,
  exercise: {
    ...entryOutput().exercise,
    id: 12,
    name: 'Bench press',
    nameJa: 'ベンチプレス',
  },
});

describe('History', () => {
  beforeEach(() => {
    localStorage.clear();
    list.mockReset();
  });

  test('lists training days newest first, each linking to the day', async () => {
    list.mockResolvedValue(
      apiResponse([
        dayOutput({ entries: [entryOutput(), bench, entryOutput({ id: 3 })] }),
        dayOutput({ date: '2026-11-17', dayNumber: 36, totalKcal: 0 }),
      ]),
    );
    renderWithProviders(<History />);

    const [first, second] = await screen.findAllByRole('link');
    expect(first).toHaveAttribute('href', '/history/2026-11-19');
    expect(within(first).getByText('Day 37')).toBeVisible();
    expect(within(first).getByText('Thu, Nov 19')).toBeVisible();
    expect(within(first).getByText('Squat, Bench press')).toBeVisible();
    expect(within(first).getByText('≈ 20 kcal')).toBeVisible();
    // No body weight yet → no calories to show.
    expect(within(second).queryByText(/kcal/)).toBeNull();
    expect(list).toHaveBeenCalledWith({ limit: 30 });
  });

  test('names exercises in Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    list.mockResolvedValue(apiResponse([dayOutput({ entries: [bench] })]));
    renderWithProviders(<History />);
    expect(await screen.findByText('ベンチプレス')).toBeVisible();
    expect(screen.getByText('37日目')).toBeVisible();
  });

  test('says how to start when there is nothing yet', async () => {
    list.mockResolvedValue(apiResponse([]));
    renderWithProviders(<History />);
    expect(
      await screen.findByText('No workouts yet. Log one from the Log tab.'),
    ).toBeVisible();
  });

  test('loads older days from the oldest one shown, without repeating it', async () => {
    const page = Array.from({ length: 30 }, (_, i) =>
      dayOutput({ date: `2026-10-${String(30 - i).padStart(2, '0')}` }),
    );
    list.mockResolvedValueOnce(apiResponse(page)).mockResolvedValueOnce(
      apiResponse([
        dayOutput({ date: '2026-10-01' }), // the overlap (`to` is inclusive)
        dayOutput({ date: '2026-09-28', dayNumber: 2 }),
      ]),
    );
    renderWithProviders(<History />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Show older days' }),
    );

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(31));
    expect(list).toHaveBeenLastCalledWith({ to: '2026-10-01', limit: 31 });
    expect(
      screen.queryByRole('button', { name: 'Show older days' }),
    ).toBeNull();
  });
});
