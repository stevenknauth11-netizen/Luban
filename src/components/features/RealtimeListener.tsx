'use client';

import { useInventoryRealtime } from '@/hooks/useInventoryRealtime';
import { useRouter } from 'next/navigation';

/**
 * Componente silencioso que se monta en el Dashboard Layout para mantener activa
 * la suscripción en tiempo real y emitir Toasts de Sonner automáticamente.
 */
export function RealtimeListener() {
  const router = useRouter();

  useInventoryRealtime({
    enableToasts: true,
    onStockChange: () => {
      // Opcional: refrescar router suavemente para que Server Components se sincronicen
      router.refresh();
    },
  });

  return null;
}
