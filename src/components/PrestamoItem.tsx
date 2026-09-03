import React, { useState } from 'react';
import { Prestamo, EstadoPrestamo } from '../types';
import { Mic, Trash2, Camera, ZoomIn, X, Store } from 'lucide-react';

interface PrestamoItemProps {
  item: Prestamo;
  currentTerminalLocal?: string;
  onCambiarEstado: (id: string, nuevoEstado: EstadoPrestamo) => void;
  onEliminar: (id: string) => void;
}

export const PrestamoItem: React.FC<PrestamoItemProps> = ({
  item,
  currentTerminalLocal,
  onCambiarEstado,
  onEliminar,
}) => {
  const [modalFotoAbierto, setModalFotoAbierto] = useState(false);

  // Check if item belongs to current terminal
  const esDeMiLocal = currentTerminalLocal && item.local &&
    (item.local.toLowerCase().trim() === currentTerminalLocal.toLowerCase().trim() ||
     item.local.toLowerCase().includes(currentTerminalLocal.toLowerCase()));

  return (
    <>
      <div className="item" id={`prestamo-${item.id}`}>
        <div className="flex items-start gap-3 flex-1">
          {/* Thumbnail if loan has a photo */}
          {item.foto && (
            <div
              className="relative group shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 w-16 h-16 shadow-2xs hover:opacity-90 transition"
              onClick={() => setModalFotoAbierto(true)}
              title="Clic para ver foto completa"
            >
              <img
                src={item.foto}
                alt="Foto del préstamo"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                <ZoomIn className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="item-info flex-1">
            {item.foto ? (
              <>
                <h3 className="flex items-center gap-1.5 font-bold text-slate-900 text-sm sm:text-base">
                  <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                  {item.descripcion || item.textoCompleto || 'Registro con Foto'}
                </h3>
              </>
            ) : item.esVoz ? (
              <>
                <h3 className="flex items-center gap-1.5 font-bold text-slate-900 text-sm sm:text-base">
                  <span className="text-base">🎙️</span> {item.textoCompleto}
                </h3>
                <p style={{ color: '#475569' }} className="flex items-center gap-1 text-xs">
                  <Mic className="w-3.5 h-3.5 text-blue-600 inline" /> Registro directo por voz
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  [{item.cantidad}] {item.descripcion}
                </h3>
              </>
            )}

            {/* Local a quien se prestó */}
            <div className="mt-1.5 text-xs text-slate-700 flex items-center flex-wrap gap-1.5">
              <span className="text-slate-500 font-medium">Local a quien se prestó:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
                  esDeMiLocal
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : 'bg-amber-100 text-amber-950 border-amber-300'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span>{item.local || 'Sin especificar'}</span>
                {esDeMiLocal && <span className="text-[10px] text-blue-700 font-normal ml-0.5">(Tu Local)</span>}
              </span>
            </div>

            {/* Row: Estación origen y Fecha */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              {item.origenTerminal && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Estación origen: <strong>{item.origenTerminal}</strong>
                </span>
              )}

              <span className="timestamp">
                📅 {item.fechaHora || 'Sin fecha'}
              </span>
            </div>
          </div>
        </div>

        <div className="actions shrink-0 ml-2">
          <select
            aria-label="Estado del préstamo"
            className={`status-select status-${item.estado}`}
            value={item.estado}
            onChange={(e) => onCambiarEstado(item.id, e.target.value as EstadoPrestamo)}
          >
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="DEBE">DEBE</option>
            <option value="ENTREGADO">ENTREGADO</option>
          </select>

          <button
            className="btn-delete"
            title="Eliminar préstamo"
            onClick={() => onEliminar(item.id)}
            aria-label="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Photo */}
      {modalFotoAbierto && item.foto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs"
          onClick={() => setModalFotoAbierto(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">
                  {item.descripcion || item.textoCompleto || 'Foto de Préstamo'}
                </span>
              </div>
              <button
                onClick={() => setModalFotoAbierto(false)}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-slate-950 flex justify-center items-center max-h-[70vh] overflow-hidden">
              <img
                src={item.foto}
                alt="Foto en grande"
                className="max-h-[65vh] w-auto object-contain rounded"
              />
            </div>
            <div className="p-3 bg-white text-xs text-slate-600 flex items-center justify-between border-t">
              <span>{item.local ? `Local: ${item.local}` : 'Sin local'}</span>
              <span>{item.fechaHora}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
