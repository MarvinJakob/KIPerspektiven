import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client, unwrap } from './client';
import type { components } from './schema';

export type ConsultationRequest = components['schemas']['ConsultationRequest'];

// Ticket #136: Anfragen für ein kostenloses Beratungsgespräch aus der Auswertung der Selbsteinschätzung.

const CONSULTATIONS_KEY = ['admin', 'consultationRequests'] as const;

export const useConsultationRequests = () =>
  useQuery({
    queryKey: CONSULTATIONS_KEY,
    queryFn: () => unwrap(client.GET('/api/admin/consultation-requests')).then((d) => d.items),
  });

export const useDeleteConsultationRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(client.DELETE('/api/admin/consultation-requests/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      qc.setQueryData<ConsultationRequest[]>(CONSULTATIONS_KEY, (list) => list?.filter((r) => r.id !== id));
      void qc.invalidateQueries({ queryKey: CONSULTATIONS_KEY });
    },
  });
};
