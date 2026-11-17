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
    const examples = within(main).getAllByRole('figure').filter((figure) => !figure.querySelector('img'));
    expect(examples).toHaveLength(6);
    examples.forEach((figure) => expect(figure).toHaveAccessibleName());
    // #2: Harness-Grafik mit Alternativtext und Link zur Originalgröße
    const diagram = within(main).getByRole('img', { name: /Harness/ });
    expect(diagram.closest('a')).toHaveAttribute('href', expect.stringContaining('harness'));
    expect(diagram.closest('a')).toHaveAttribute('target', '_blank');
    expect(within(main).getByRole('blockquote')).toHaveTextContent('Humans should review ideas, not code.');
    expect(within(main).getByRole('link', { name: /Readiness/ })).toHaveAttribute('href', `/${lang}/themen/ai-audit`);
    await user.click(within(main).getByRole('link', { name: /topic overview|Themenübersicht/ }));
    expect(router.state.location.pathname).toBe(`/${lang}`);
  });
});
