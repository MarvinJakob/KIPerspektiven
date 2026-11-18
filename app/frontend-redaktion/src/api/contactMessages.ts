import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client, unwrap } from './client';
import type { components } from './schema';

export type ContactMessage = components['schemas']['ContactMessage'];

// Anforderung #4: Nachrichten von der öffentlichen Kontaktseite. Ticket #90: einzelne Nachrichten löschen.

const CONTACT_MESSAGES_KEY = ['admin', 'contactMessages'] as const;

export const useContactMessages = () =>
  useQuery({
    queryKey: CONTACT_MESSAGES_KEY,
    queryFn: () => unwrap(client.GET('/api/admin/contact-messages')).then((d) => d.items),
  });

export const useDeleteContactMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(client.DELETE('/api/admin/contact-messages/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      qc.setQueryData<ContactMessage[]>(CONTACT_MESSAGES_KEY, (list) => list?.filter((m) => m.id !== id));
      void qc.invalidateQueries({ queryKey: CONTACT_MESSAGES_KEY });
    },
  });
};
