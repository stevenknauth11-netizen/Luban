'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { EquipmentStock } from '@/lib/types';
import { Printer, X, Cpu, MapPin, Tag } from 'lucide-react';

interface EquipmentQrModalProps {
  item: EquipmentStock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EquipmentQrModal({ item, isOpen, onClose }: EquipmentQrModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !item) return null;

  // Generar contenido del QR: JSON estructurado para escáneres industriales o URL de consulta
  const qrPayload = JSON.stringify({
    system: 'TallerLuban-IoT',
    id: item.id,
    sku: `LBN-${String(item.id).padStart(4, '0')}`,
    name: item.name,
    category: item.category,
    loc: item.location || 'N/A',
  });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs print:p-0 print:bg-transparent">
      {/* Modal Container */}
      <div className="card w-full max-w-[95%] sm:max-w-md max-h-[92vh] overflow-y-auto bg-white shadow-2xl print:shadow-none print:border-none print:w-auto">
        {/* Modal Header (Oculto al imprimir) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 print:hidden sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-red-600" />
            <h2 className="text-base font-bold text-slate-900">
              Etiqueta Industrial & Código QR
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Área imprimible */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 print:p-0">
          {/* Tarjeta de Etiqueta Física Industrial */}
          <div
            ref={printAreaRef}
            id="printable-label"
            className="border-2 border-dashed border-slate-300 rounded-lg p-4 sm:p-5 bg-slate-50/50 print:border-2 print:border-solid print:border-black print:bg-white print:p-4 print:m-0 print:w-[320px]"
          >
            {/* Cabecera de Etiqueta */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <span className="font-extrabold text-xs tracking-wider text-slate-900 uppercase">
                  Taller Luban
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700">
                SKU: LBN-{String(item.id).padStart(4, '0')}
              </span>
            </div>

            {/* Contenido Central: QR + Metadatos */}
            <div className="flex items-center gap-4">
              {/* Código QR */}
              <div className="bg-white p-2 rounded border border-slate-300 print:border-black flex-shrink-0">
                <QRCodeSVG
                  value={qrPayload}
                  size={96}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Información Técnica */}
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                  {item.name}
                </p>
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  {item.category}
                </p>
                <div className="pt-1 flex items-center gap-1 text-[11px] text-slate-500">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{item.location || 'Estantería General'}</span>
                </div>
              </div>
            </div>

            {/* Pie de Etiqueta */}
            <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>NEWLab IoT Station</span>
              <span>ID #{item.id}</span>
            </div>
          </div>

          {/* Información complementaria (Oculta al imprimir) */}
          <div className="text-xs text-slate-500 space-y-1 bg-slate-100 p-3 rounded print:hidden">
            <p className="font-medium text-slate-700">Payload codificado en el QR:</p>
            <p className="font-mono text-[11px] text-slate-600 break-all bg-white p-2 rounded border border-slate-200">
              {qrPayload}
            </p>
            <p className="text-[10px] text-slate-400 pt-1">
              Escaneable con cualquier lector 2D o terminal móvil del taller.
            </p>
          </div>

          {/* Botones de acción (Ocultos al imprimir) */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary text-sm gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center"
            >
              <Printer className="w-4 h-4" />
              Imprimir Etiqueta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
