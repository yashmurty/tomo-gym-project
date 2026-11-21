import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../lib/auth-context';
import {
  apiResponse,
  PROFILE,
  renderWithProviders,
  signIn,
} from '../test/render';
import { useI18n } from './i18n-context';

const getMyProfile = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: getMyProfile,
  userControllerUpdateUser: updateUser,
}));

function Probe() {
  const { t } = useI18n();
  const { logout } = useAuth();
  return (
    <>
      <h1>{t('nav.history')}</h1>
      <LanguageToggle />
      <button type="button" onClick={logout}>
        logout
      </button>
    </>
  );
}

function setBrowserLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

const heading = () => screen.getByRole('heading', { level: 1 });
const toggle = (name: string) => screen.getByRole('button', { name });

describe('I18nProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    getMyProfile.mockReset();
    updateUser.mockReset();
    setBrowserLanguages(['en-US']);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('signed out', () => {
    test("follows the browser's language", () => {
      setBrowserLanguages(['ja-JP', 'en']);
      renderWithProviders(<Probe />);
      expect(heading()).toHaveTextContent('履歴');
      expect(document.documentElement.lang).toBe('ja');
    });

    test('prefers the language last chosen on this device', () => {
      localStorage.setItem('tomo.locale', 'ja');
      renderWithProviders(<Probe />);
      expect(heading()).toHaveTextContent('履歴');
    });

    test('the toggle switches the UI and remembers the choice', async () => {
      renderWithProviders(<Probe />);
      expect(heading()).toHaveTextContent('History');
      expect(toggle('English')).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(toggle('日本語'));

      expect(heading()).toHaveTextContent('履歴');
      expect(toggle('日本語')).toHaveAttribute('aria-pressed', 'true');
      expect(document.documentElement.lang).toBe('ja');
      expect(localStorage.getItem('tomo.locale')).toBe('ja');
      expect(updateUser).not.toHaveBeenCalled();
    });
  });

  describe('signed in', () => {
    beforeEach(() => signIn());

    test("uses the user's saved locale over the browser's", async () => {
      getMyProfile.mockResolvedValue(apiResponse({ ...PROFILE, locale: 'ja' }));
      renderWithProviders(<Probe />);
      await waitFor(() => expect(heading()).toHaveTextContent('履歴'));
    });

    test('the toggle saves the choice as User.locale', async () => {
      getMyProfile.mockResolvedValue(apiResponse(PROFILE));
      updateUser.mockResolvedValue(apiResponse({ ...PROFILE, locale: 'ja' }));
      renderWithProviders(<Probe />);
      await waitFor(() => expect(getMyProfile).toHaveBeenCalled());

      await userEvent.click(toggle('日本語'));

      expect(updateUser).toHaveBeenCalledWith(PROFILE.id, { locale: 'ja' });
      expect(heading()).toHaveTextContent('履歴');
    });

    test('shows the new language before the save returns', async () => {
      getMyProfile.mockResolvedValue(apiResponse(PROFILE));
      let finishSave!: (value: unknown) => void;
      updateUser.mockReturnValue(
        new Promise((resolve) => (finishSave = resolve)),
      );
      renderWithProviders(<Probe />);
      await waitFor(() => expect(getMyProfile).toHaveBeenCalled());

      await userEvent.click(toggle('日本語'));
      expect(heading()).toHaveTextContent('履歴');

      await act(async () =>
        finishSave(apiResponse({ ...PROFILE, locale: 'ja' })),
      );
      expect(heading()).toHaveTextContent('履歴');
    });

    test('reverts and says so when the save fails', async () => {
      getMyProfile.mockResolvedValue(apiResponse(PROFILE));
      updateUser.mockRejectedValue(new Error('Network down'));
      renderWithProviders(<Probe />);
      await waitFor(() => expect(getMyProfile).toHaveBeenCalled());

      await userEvent.click(toggle('日本語'));

      expect(heading()).toHaveTextContent('History');
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Couldn't save your language",
      );
    });

    test('keeps showing the saved language after logout', async () => {
      getMyProfile.mockResolvedValue(apiResponse({ ...PROFILE, locale: 'ja' }));
      renderWithProviders(<Probe />);
      await waitFor(() => expect(heading()).toHaveTextContent('履歴'));

      await userEvent.click(screen.getByRole('button', { name: 'logout' }));

      expect(heading()).toHaveTextContent('履歴');
      expect(localStorage.getItem('tomo.locale')).toBe('ja');
    });
  });
});
