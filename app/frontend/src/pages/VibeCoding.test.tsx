import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeApi, renderApp } from '../test/fakeApi';

beforeEach(() => { installFakeApi(); });

describe('#29 Vibe Coding integration', () => {
  it.each(['de', 'en'])('opens from the %s home page and preserves language in onward links', async (lang) => {
    const user = userEvent.setup();
    const { router } = renderApp(`/${lang}`);
    await user.click(await screen.findByRole('link', { name: /article: Vibe Coding|Artikel: Vibe Coding/ }));
    await screen.findByRole('heading', { level: 1, name: 'Vibe Coding' });
    expect(router.state.location.pathname).toBe(`/${lang}/themen/vibe-coding`);
    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('figure')).toHaveLength(6);
    within(main).getAllByRole('figure').forEach((figure) => expect(figure).toHaveAccessibleName());
    expect(within(main).getByRole('blockquote')).toHaveTextContent('Humans should review ideas, not code.');
    expect(within(main).getByRole('link', { name: /Readiness/ })).toHaveAttribute('href', `/${lang}/themen/ai-audit`);
    await user.click(within(main).getByRole('link', { name: /topic overview|Themenübersicht/ }));
    expect(router.state.location.pathname).toBe(`/${lang}`);
  });
});
