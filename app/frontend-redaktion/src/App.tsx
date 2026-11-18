import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';
import { ApiError, ME_KEY, isStatus } from './api/client';
import { Layout, RequireRole } from './components/Layout';
import { ConsultationRequestsPage } from './pages/ConsultationRequests';
import { ContactMessagesPage } from './pages/ContactMessages';
import { LoginPage } from './pages/Login';
import { EditPostPage } from './pages/EditPost';
import { NotFound } from './pages/NotFound';
import { PostsPage } from './pages/Posts';
import { ArticlesPage, ArticleEditorPage } from './pages/Articles';
import { ProfilePage } from './pages/Profile';
import { StatisticsPage } from './pages/Statistics';
import { UsersPage } from './pages/Users';

/** Basispfad des Redaktionsfrontends. */
export const BASENAME = '/redaktion';

/** Routen der Redaktion (ARCHITECTURE.md, Abschnitt 3). Das Backend prüft dieselben Regeln beim Seitenaufruf. */
export const routes: RouteObject[] = [
  { path: '/anmelden', element: <LoginPage /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <RequireRole can="posts"><PostsPage /></RequireRole> },
      { path: 'beitraege/:id', element: <RequireRole can="posts"><EditPostPage /></RequireRole> },
      { path: 'themenartikel', element: <RequireRole can="posts"><ArticlesPage /></RequireRole> },
      { path: 'themenartikel/:id', element: <RequireRole can="posts"><ArticleEditorPage /></RequireRole> },
      { path: 'statistik', element: <RequireRole can="insights"><StatisticsPage /></RequireRole> },
      { path: 'beratungsanfragen', element: <RequireRole can="insights"><ConsultationRequestsPage /></RequireRole> },
      { path: 'nachrichten', element: <RequireRole can="insights"><ContactMessagesPage /></RequireRole> },
      { path: 'benutzer', element: <RequireRole can="users"><UsersPage /></RequireRole> },
      { path: 'profil', element: <ProfilePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export function createQueryClient() {
  // Läuft eine Sitzung ab, liefern geschützte Aufrufe 401. Dann wird die Person neu geprüft,
  // und die Oberfläche führt zur Anmeldung.
  let client: QueryClient;
  const on401 = (err: unknown) => {
    if (isStatus(err, 401)) client.setQueryData(ME_KEY, null);
  };
  client = new QueryClient({
    queryCache: new QueryCache({ onError: on401 }),
    mutationCache: new MutationCache({ onError: on401 }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      },
    },
  });
  return client;
}

export function Providers({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
