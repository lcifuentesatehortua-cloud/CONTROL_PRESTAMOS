import React, { useState } from 'react';
import { ActiveDevice } from '../types';
import { Store, X, Check, Laptop, Wifi } from 'lucide-react';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  terminalLocal: string;
  onSaveTerminalLocal: (localName: string) => void;
  connectedDevices: ActiveDevice[];
  deviceId: string;
}

const PRESET_LOCALES = ['Local 89', 'Local 94', 'Local 102', 'Bodega Central', 'Administración'];

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  terminalLocal,
  onSaveTerminalLocal,
  connectedDevices,
  deviceId,
}) => {
  const [selectedLocal, setSelectedLocal] = useState(terminalLocal);
  const [customLocal, setCustomLocal] = useState('');

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLocal = customLocal.trim() || selectedLocal || 'Local 89';
    onSaveTerminalLocal(finalLocal);
    onClose();
  };

  return (
    <div
      id="device-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="device-modal-dialog"
        className="w-full max-w-[500px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Estación / Local de este Dispositivo</h3>
              <p className="text-xs text-slate-400">
                Define a qué estación o local corresponde esta pantalla
              </p>
            </div>
          </div>
          <button
            id="btn-close-device-modal"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 flex flex-col gap-4">
          {/* Select Estación / Local */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Estación o Local de esta pantalla:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2.5">
              {PRESET_LOCALES.map((loc) => {
                const isCurrent = (customLocal === '' && selectedLocal === loc);
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setSelectedLocal(loc);
                      setCustomLocal('');
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    {loc}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="O escribe otro local o estación (ej. Local 45, Bodega 2)"
                value={customLocal}
                onChange={(e) => {
                  setCustomLocal(e.target.value);
                  setSelectedLocal('');
                }}
                className="text-xs py-2 px-3 flex-1 bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Esta pantalla quedará identificada como:{' '}
              <strong className="text-blue-600 font-bold">
                {customLocal.trim() || selectedLocal || 'Local 89'}
              </strong>.
            </p>
          </div>

          {/* Connected Devices status */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                Estaciones / Dispositivos Conectados ({connectedDevices.length})
              </span>
              <span className="text-[10px] text-slate-400">ID: {deviceId.slice(0, 8)}</span>
            </div>

            <div className="flex flex-col gap-1 text-xs text-slate-600">
              {connectedDevices.map((dev) => (
                <div
                  key={dev.deviceId}
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded ${
                    dev.deviceId === deviceId
                      ? 'bg-blue-100/60 font-semibold text-blue-900 border border-blue-200'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    <strong>{dev.local}</strong>
                  </span>
                  {dev.deviceId === deviceId ? (
                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">
                      Este Dispositivo
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                      En línea
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="text-[11px] text-slate-500 bg-amber-50/70 border border-amber-200/70 p-2.5 rounded-lg flex items-start gap-2">
            <span className="text-base">💡</span>
            <div>
              <strong>Uso con múltiples dispositivos:</strong> Puedes abrir este enlace en otro
              dispositivo y asignarle su respectiva estación (ej. <strong>Local 94</strong> o{' '}
              <strong>Local 89</strong>). Los registros se sincronizan automáticamente en tiempo real entre todos.
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-5 py-2 font-bold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Guardar Estación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
