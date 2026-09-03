import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Prestamo, EstadoPrestamo, ActiveDevice } from './types';
import { PrestamoItem } from './components/PrestamoItem';
import { DeviceModal } from './components/DeviceModal';
import {
  Search,
  Calendar,
  X,
  Camera,
  Video,
  Check,
  RotateCcw,
  Store,
  Laptop,
  Globe,
  Wifi,
  RefreshCw,
} from 'lucide-react';

// Compress image before saving to DB
function comprimirImagen(fileOrBlob: Blob | File, maxWidth = 1000, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('prestamos_device_id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now().toString(36);
    localStorage.setItem('prestamos_device_id', id);
  }
  return id;
}

function getInitialTerminalLocal(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('local') || params.get('terminal');
    if (fromUrl) {
      const formatted = fromUrl.toLowerCase().startsWith('local')
        ? fromUrl
        : `Local ${fromUrl}`;
      localStorage.setItem('prestamos_terminal_local', formatted);
      return formatted;
    }
    const stored = localStorage.getItem('prestamos_terminal_local');
    if (stored) return stored;
  }
  return 'Local 89';
}

// Extract friendly day label
function obtenerInfoDia(item: Prestamo): { key: string; label: string; timestamp: number } {
  let date: Date;
  if (item.createdAt) {
    date = new Date(item.createdAt);
  } else if (item.fechaIso) {
    date = new Date(item.fechaIso);
  } else if (item.fechaHora) {
    const match = item.fechaHora.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      date = new Date(year, month, day);
    } else {
      const t = Date.parse(item.fechaHora);
      date = isNaN(t) ? new Date() : new Date(t);
    }
  } else {
    date = new Date();
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${year}-${month}-${day}`;

  const hoy = new Date();
  const esHoy =
    hoy.getFullYear() === date.getFullYear() &&
    hoy.getMonth() === date.getMonth() &&
    hoy.getDate() === date.getDate();

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const esAyer =
    ayer.getFullYear() === date.getFullYear() &&
    ayer.getMonth() === date.getMonth() &&
    ayer.getDate() === date.getDate();

  const textoFecha = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const capitalizada = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);

  let label = capitalizada;
  if (esHoy) {
    label = `Hoy • ${capitalizada}`;
  } else if (esAyer) {
    label = `Ayer • ${capitalizada}`;
  }

  return { key, label, timestamp: date.getTime() };
}

export default function App() {
  const [deviceId] = useState<string>(getOrCreateDeviceId);
  const [terminalLocal, setTerminalLocal] = useState<string>(getInitialTerminalLocal);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<ActiveDevice[]>([]);

  // Interface view: 'ESTE_LOCAL' (Mi Interfaz) vs 'TODOS' (Vista General de todos los locales)
  const [vistaModo, setVistaModo] = useState<'ESTE_LOCAL' | 'TODOS'>('ESTE_LOCAL');

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [dbConnected, setDbConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form inputs for manual loan
  const [cantidad, setCantidad] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [local, setLocal] = useState<string>('');

  // Voice recording state
  const [grabando, setGrabando] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef<any>(null);

  // Photo capture states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camaraEnVivoActiva, setCamaraEnVivoActiva] = useState(false);
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null);
  const [fotoDescripcion, setFotoDescripcion] = useState<string>('');
  const [fotoLocal, setFotoLocal] = useState<string>('');
  const [guardandoFoto, setGuardandoFoto] = useState(false);

  // Search and Filters
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroLocalEspecifico, setFiltroLocalEspecifico] = useState<string>('TODOS');

  // Persist terminal local
  useEffect(() => {
    localStorage.setItem('prestamos_terminal_local', terminalLocal);
  }, [terminalLocal]);

  // Format display date/time
  const obtenerFechaHoraActual = () => {
    return new Date().toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // 1. Synchronize Data with Backend Database
  const sincronizar = useCallback(async (silencioso = true) => {
    if (!silencioso) setSyncing(true);
    try {
      const [resPrestamos, resHeartbeat] = await Promise.all([
        fetch('/api/prestamos'),
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            local: terminalLocal,
          }),
        }),
      ]);

      if (resPrestamos.ok) {
        const prestamosData: Prestamo[] = await resPrestamos.json();
        setPrestamos(prestamosData);
        setDbConnected(true);
      }

      if (resHeartbeat.ok) {
        const hbData = await resHeartbeat.json();
        if (hbData.activeDevices) {
          setConnectedDevices(hbData.activeDevices);
        }
      }
    } catch (err) {
      console.warn('API error, using local storage cache:', err);
    } finally {
      if (!silencioso) setSyncing(false);
    }
  }, [deviceId, terminalLocal]);

  // Initial load
  useEffect(() => {
    sincronizar(false);
  }, [sincronizar]);

  // Periodic polling for real-time multi-device synchronization (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      sincronizar(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [sincronizar]);

  useEffect(() => {
    localStorage.setItem('prestamos_data', JSON.stringify(prestamos));
  }, [prestamos]);

  // 2. Save Loan to Database
  const guardarRegistroDirecto = useCallback(
    async (nuevo: Partial<Prestamo>) => {
      const now = Date.now();
      const prestamoPayload = {
        ...nuevo,
        local: nuevo.local || terminalLocal,
        origenTerminal: terminalLocal,
        fechaHora: obtenerFechaHoraActual(),
        createdAt: now,
        fechaIso: new Date(now).toISOString(),
        estado: nuevo.estado || 'PENDIENTE',
      };

      try {
        const res = await fetch('/api/prestamos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prestamoPayload),
        });
        if (res.ok) {
          const savedItem = await res.json();
          setPrestamos((prev) => [savedItem, ...prev]);
          setDbConnected(true);
          return;
        }
      } catch (error) {
        console.error('Error guardando en BD:', error);
      }

      // Local fallback
      const localFallback: Prestamo = {
        id: `local-${Date.now()}`,
        esVoz: Boolean(prestamoPayload.esVoz),
        textoCompleto: prestamoPayload.textoCompleto,
        cantidad: prestamoPayload.cantidad,
        descripcion: prestamoPayload.descripcion,
        local: prestamoPayload.local,
        origenTerminal: terminalLocal,
        foto: prestamoPayload.foto,
        fechaHora: prestamoPayload.fechaHora,
        createdAt: now,
        fechaIso: new Date(now).toISOString(),
        estado: prestamoPayload.estado as EstadoPrestamo,
      };
      setPrestamos((prev) => [localFallback, ...prev]);
    },
    [terminalLocal]
  );

  // Voice recording
  const iniciarGrabacion = useCallback(() => {
    if (!recognitionRef.current) return;
    if (!grabando) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Error al iniciar el micrófono:', e);
      }
    } else {
      recognitionRef.current.stop();
    }
  }, [grabando]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setGrabando(true);
        setVoiceStatus(`Escuchando en ${terminalLocal}... Al pausar se guardará solo`);
      };

      recognition.onresult = (event: any) => {
        const textoGrabado = event.results[0][0].transcript;
        setVoiceStatus(`Registrado para ${terminalLocal}: "${textoGrabado}"`);

        guardarRegistroDirecto({
          esVoz: true,
          local: terminalLocal,
          textoCompleto:
            textoGrabado.charAt(0).toUpperCase() + textoGrabado.slice(1),
        });
      };

      recognition.onerror = (event: any) => {
        setVoiceStatus('Error al escuchar: ' + event.error);
        setGrabando(false);
      };

      recognition.onend = () => {
        setGrabando(false);
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceStatus('Micrófono no soportado en este navegador. Usa Chrome o Edge.');
    }
  }, [guardarRegistroDirecto, terminalLocal]);

  // Keyboard shortcut [ 1 ]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const estaEscribiendo =
        activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if (
        (e.code === 'Numpad1' || e.code === 'Digit1' || e.key === '1') &&
        !estaEscribiendo
      ) {
        e.preventDefault();
        iniciarGrabacion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [iniciarGrabacion]);

  // 3. Photo capture handlers
  const handleFilePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await comprimirImagen(file);
      setFotoCapturada(base64);
      setFotoDescripcion('');
      setFotoLocal('');
    } catch (err) {
      console.error('Error al procesar foto:', err);
    }
    e.target.value = '';
  };

  const iniciarCamaraEnVivo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCamaraEnVivoActiva(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      fileInputRef.current?.click();
    }
  };

  const detenerCamaraEnVivo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamaraEnVivoActiva(false);
  };

  const tomarInstantaneaCamara = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFotoCapturada(dataUrl);
      detenerCamaraEnVivo();
      setFotoDescripcion('');
      setFotoLocal('');
    }
  };

  const handleGuardarFotoPrestamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoCapturada) return;
    setGuardandoFoto(true);
    try {
      await guardarRegistroDirecto({
        esVoz: false,
        foto: fotoCapturada,
        descripcion: fotoDescripcion.trim() || 'Préstamo con Foto',
        local: fotoLocal.trim() || terminalLocal,
        estado: 'PENDIENTE',
      });
      setFotoCapturada(null);
      setFotoDescripcion('');
      setFotoLocal('');
    } catch (err) {
      console.error('Error guardando préstamo con foto:', err);
    } finally {
      setGuardandoFoto(false);
    }
  };

  // 4. Loan actions
  const handleCambiarEstado = async (id: string, nuevoEstado: EstadoPrestamo) => {
    setPrestamos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
    );

    try {
      await fetch(`/api/prestamos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
    } catch (err) {
      console.error('Error actualizando estado en BD:', err);
    }
  };

  const handleEliminarPrestamo = async (id: string) => {
    setPrestamos((prev) => prev.filter((item) => item.id !== id));
    try {
      await fetch(`/api/prestamos/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error eliminando de BD:', err);
    }
  };

  // 6. Manual form submission
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantidad || !descripcion.trim() || !local.trim()) return;

    await guardarRegistroDirecto({
      esVoz: false,
      cantidad: Number(cantidad) || cantidad,
      descripcion: descripcion.trim(),
      local: local.trim(),
      estado: 'PENDIENTE',
    });

    setCantidad('');
    setDescripcion('');
    setLocal('');
  };

  // List of distinct locales registered
  const listaLocalesUnicos = useMemo(() => {
    const setL = new Set<string>();
    setL.add('Local 89');
    setL.add('Local 94');
    if (terminalLocal) setL.add(terminalLocal);
    prestamos.forEach((p) => {
      if (p.local && p.local.trim()) setL.add(p.local.trim());
    });
    return Array.from(setL);
  }, [prestamos, terminalLocal]);

  // 7. Filtered Loans by Interface Mode, Search & Status
  const prestamosFiltrados = useMemo(() => {
    return prestamos.filter((p) => {
      // If in 'ESTE_LOCAL' mode, only show loans matching this device's local
      if (vistaModo === 'ESTE_LOCAL') {
        const itemLocal = (p.local || '').toLowerCase().trim();
        const termLocal = terminalLocal.toLowerCase().trim();
        const matchesThisTerminal =
          itemLocal === termLocal ||
          itemLocal.includes(termLocal) ||
          (p.origenTerminal && p.origenTerminal.toLowerCase().trim() === termLocal);
        if (!matchesThisTerminal) return false;
      } else if (filtroLocalEspecifico !== 'TODOS') {
        // Specific local filter inside global view
        const itemLocal = (p.local || '').toLowerCase().trim();
        if (itemLocal !== filtroLocalEspecifico.toLowerCase().trim()) return false;
      }

      // Filter by status
      if (filtroEstado !== 'TODOS' && p.estado !== filtroEstado) {
        return false;
      }

      // Search by description, local, or voice text
      if (filtroTexto.trim()) {
        const query = filtroTexto.trim().toLowerCase();
        const matchesDesc = (p.descripcion || '').toLowerCase().includes(query);
        const matchesLocal = (p.local || '').toLowerCase().includes(query);
        const matchesVoz = (p.textoCompleto || '').toLowerCase().includes(query);
        return matchesDesc || matchesLocal || matchesVoz;
      }
      return true;
    });
  }, [prestamos, vistaModo, terminalLocal, filtroLocalEspecifico, filtroEstado, filtroTexto]);

  // 8. Group loans by day
  const gruposPorDia = useMemo(() => {
    const mapa = new Map<string, { label: string; timestamp: number; items: Prestamo[] }>();

    for (const item of prestamosFiltrados) {
      const { key, label, timestamp } = obtenerInfoDia(item);
      if (!mapa.has(key)) {
        mapa.set(key, { label, timestamp, items: [] });
      }
      mapa.get(key)!.items.push(item);
    }

    return Array.from(mapa.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([key, data]) => ({
        key,
        label: data.label,
        items: data.items,
      }));
  }, [prestamosFiltrados]);

  // Count of loans for this local
  const conteoEsteLocal = useMemo(() => {
    const termLocal = terminalLocal.toLowerCase().trim();
    return prestamos.filter((p) => {
      const itemLocal = (p.local || '').toLowerCase().trim();
      return (
        itemLocal === termLocal ||
        itemLocal.includes(termLocal) ||
        (p.origenTerminal && p.origenTerminal.toLowerCase().trim() === termLocal)
      );
    }).length;
  }, [prestamos, terminalLocal]);

  return (
    <div className="container">
      {/* HEADER */}
      <header>
        <div>
          <h1>Control de Préstamos</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge-db" title="Datos guardados de forma persistente">
              <span className="dot" />
              {dbConnected ? 'Base de Datos Conectada' : 'Base de Datos Local'}
            </span>

            <button
              onClick={() => sincronizar(false)}
              className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
              title="Forzar sincronización ahora"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="text-[11px]">Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Action Buttons: Terminal Setup */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-terminal-config"
            onClick={() => setIsDeviceModalOpen(true)}
            className="btn-secondary flex items-center gap-1.5 font-bold text-xs"
            title="Configurar Estación / Local de este dispositivo"
          >
            <Laptop className="w-3.5 h-3.5 text-blue-600" />
            <span>Estación: {terminalLocal}</span>
          </button>
        </div>
      </header>

      {/* MULTI-DEVICE STATUS & ACTIVE STATION BAR */}
      <div className="card mb-3 py-2.5 px-3.5 bg-slate-900 text-white border-0 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>
            Dispositivo actual: <strong className="text-amber-300 font-bold">{terminalLocal}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {connectedDevices.length > 1 && (
            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              {connectedDevices.length} dispositivos en línea
            </span>
          )}
          <button
            onClick={() => setIsDeviceModalOpen(true)}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
          >
            Cambiar Local / Estación
          </button>
        </div>
      </div>

      {/* MAIN CARD: VOICE BUTTON + PHOTO CAPTURE + MANUAL FORM */}
      <div className="card">
        {/* BOTÓN DE GRABACIÓN DIRECTA CON ACCESO RÁPIDO [1] */}
        <button
          type="button"
          id="btnMic"
          onClick={iniciarGrabacion}
          className={`btn-voice ${grabando ? 'listening' : ''}`}
        >
          <span id="micIcon">{grabando ? '🔴' : '🎙️'}</span>
          <span id="micText">
            {grabando
              ? 'Escuchando... Di lo que vas a prestar'
              : 'Presiona [ 1 ] para grabar por voz'}
          </span>
        </button>

        <div id="voiceStatus" className="voice-status">
          {voiceStatus}
        </div>

        {/* BOTÓN DE FOTO PARA REGISTRO (DEBAJO DE LA VOZ) */}
        <div className="mt-2">
          {!camaraEnVivoActiva && !fotoCapturada && (
            <div className="flex gap-2">
              <button
                type="button"
                id="btnFotoDirecta"
                onClick={() => fileInputRef.current?.click()}
                className="btn-camera flex-1"
                title="Tomar foto para registro"
              >
                <Camera className="w-5 h-5 text-blue-400 shrink-0" />
                <span>📸 Tomar Foto para Registro</span>
              </button>

              <button
                type="button"
                id="btnCamaraEnVivo"
                onClick={iniciarCamaraEnVivo}
                className="btn-secondary mt-2 px-3 flex items-center justify-center gap-1.5"
                title="Abrir cámara web en pantalla"
              >
                <Video className="w-4 h-4 text-slate-600" />
                <span className="text-xs hidden sm:inline">Cámara Web</span>
              </button>
            </div>
          )}

          {/* Hidden native camera file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilePhotoSelect}
          />

          {/* LIVE CAMERA VIEWFINDER */}
          {camaraEnVivoActiva && (
            <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center">
              <div className="w-full relative rounded-lg overflow-hidden bg-black aspect-4/3 max-h-60 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center gap-3 mt-3 w-full">
                <button
                  type="button"
                  onClick={tomarInstantaneaCamara}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 font-bold"
                >
                  <Camera className="w-4 h-4" />
                  Capturar Foto
                </button>
                <button
                  type="button"
                  onClick={detenerCamaraEnVivo}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* PREVIEW AND REGISTRATION OF CAPTURED PHOTO */}
          {fotoCapturada && (
            <form
              onSubmit={handleGuardarFotoPrestamo}
              className="mt-3 p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-600" />
                  Foto tomada para registrar en {fotoLocal}
                </h4>
                <button
                  type="button"
                  onClick={() => setFotoCapturada(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Descartar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3 items-center">
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 shadow-2xs">
                  <img
                    src={fotoCapturada}
                    alt="Captura"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <input
                    type="text"
                    placeholder="Descripción (ej. 3 cargadores)"
                    value={fotoDescripcion}
                    onChange={(e) => setFotoDescripcion(e.target.value)}
                    required
                    className="text-sm py-1.5 px-2.5 w-full bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Local a quien se prestó (ej. Local 94)"
                    value={fotoLocal}
                    onChange={(e) => setFotoLocal(e.target.value)}
                    required
                    className="text-sm py-1.5 px-2.5 w-full bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="submit"
                  disabled={guardandoFoto}
                  className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5 font-bold"
                >
                  <Check className="w-4 h-4" />
                  {guardandoFoto ? 'Guardando en BD...' : (fotoLocal.trim() ? `Prestar a ${fotoLocal.trim()}` : 'Guardar Préstamo')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFotoCapturada(null);
                    fileInputRef.current?.click();
                  }}
                  className="btn-secondary py-2 text-xs"
                  title="Tomar otra foto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repetir
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="separator">O REGISTRO MANUAL</div>

        {/* REGISTRO MANUAL */}
        <form id="loanForm" onSubmit={handleSubmitManual} className="form-group">
          <input
            type="number"
            id="cant"
            placeholder="1. Cantidad (ej. 3)"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
          <input
            type="text"
            id="desc"
            placeholder="2. Descripción del producto"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
          <input
            type="text"
            id="local"
            placeholder="3. Local a quien se prestó (ej. Local 94)"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">
            {local.trim() ? `Prestar a ${local.trim()}` : 'Guardar Préstamo'}
          </button>
        </form>
      </div>

      {/* DISTINCT INTERFACES SWITCHER TABS */}
      <div className="interface-tabs">
        <button
          type="button"
          onClick={() => setVistaModo('ESTE_LOCAL')}
          className={`interface-tab-btn ${vistaModo === 'ESTE_LOCAL' ? 'active' : ''}`}
        >
          <Store className="w-4 h-4 text-blue-600" />
          <span>Mi Interfaz ({terminalLocal})</span>
          <span className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold ml-1">
            {conteoEsteLocal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setVistaModo('TODOS')}
          className={`interface-tab-btn ${vistaModo === 'TODOS' ? 'active' : ''}`}
        >
          <Globe className="w-4 h-4 text-slate-600" />
          <span>Vista General (Todos los Locales)</span>
          <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold ml-1">
            {prestamos.length}
          </span>
        </button>
      </div>

      {/* BUSCADOR DE DESCRIPCIONES O LOCAL */}
      <div className="mb-3">
        <div className="search-box-wrapper">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            id="input-buscador"
            type="text"
            placeholder={`Buscar en préstamos de ${vistaModo === 'ESTE_LOCAL' ? terminalLocal : 'todos los locales'}...`}
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="search-input-field"
          />
          {filtroTexto && (
            <button
              onClick={() => setFiltroTexto('')}
              className="p-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold rounded-full transition mr-1"
              title="Limpiar buscador"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global view local switcher pills */}
        {vistaModo === 'TODOS' && listaLocalesUnicos.length > 1 && (
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto py-1">
            <span className="text-xs text-slate-500 font-semibold shrink-0">Filtrar Local:</span>
            <button
              onClick={() => setFiltroLocalEspecifico('TODOS')}
              className={`filter-btn ${filtroLocalEspecifico === 'TODOS' ? 'active' : ''}`}
            >
              Todos los Locales
            </button>
            {listaLocalesUnicos.map((loc) => (
              <button
                key={loc}
                onClick={() => setFiltroLocalEspecifico(loc)}
                className={`filter-btn ${filtroLocalEspecifico === loc ? 'active' : ''}`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* Status filters and summary */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <h2>
            {vistaModo === 'ESTE_LOCAL'
              ? `Préstamos de ${terminalLocal} (${prestamosFiltrados.length})`
              : `Todos los Préstamos (${prestamosFiltrados.length})`}
          </h2>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['TODOS', 'PENDIENTE', 'DEBE', 'ENTREGADO'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroEstado(st)}
                className={`filter-btn ${filtroEstado === st ? 'active' : ''}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filtroTexto.trim() && (
          <div className="mt-2 text-xs text-slate-600 bg-blue-50/70 border border-blue-200/60 rounded-md py-1.5 px-3 flex items-center justify-between">
            <span>
              Filtrando por: <strong>&quot;{filtroTexto.trim()}&quot;</strong> (
              {prestamosFiltrados.length} encontrados)
            </span>
            <button
              onClick={() => setFiltroTexto('')}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Mostrar todos
            </button>
          </div>
        )}
      </div>

      {/* LISTA DE PRESTAMOS DIVIDIDA POR DÍAS */}
      <div id="lista" style={{ marginTop: '10px' }}>
        {prestamosFiltrados.length === 0 ? (
          <div className="card text-center py-8 text-slate-500 text-sm">
            {prestamos.length === 0 ? (
              'No hay préstamos registrados aún. Usa la voz [ 1 ], toma una foto 📸 o usa el formulario para registrar el primero.'
            ) : vistaModo === 'ESTE_LOCAL' ? (
              <div>
                <p className="font-semibold text-slate-700">
                  No hay préstamos registrados para {terminalLocal}.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Puedes registrar uno ahora mismo desde este dispositivo o cambiar a la{' '}
                  <button
                    onClick={() => setVistaModo('TODOS')}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Vista General
                  </button>{' '}
                  para ver los préstamos de otros locales.
                </p>
              </div>
            ) : filtroTexto.trim() ? (
              `No se encontraron préstamos con la búsqueda "${filtroTexto}".`
            ) : (
              'No se encontraron préstamos con el filtro seleccionado.'
            )}
          </div>
        ) : (
          gruposPorDia.map((grupo) => (
            <div key={grupo.key} className="day-group mb-4">
              {/* Separador de Día */}
              <div className="day-divider">
                <span className="day-divider-title">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  {grupo.label}
                </span>
                <span className="day-divider-badge">
                  {grupo.items.length}{' '}
                  {grupo.items.length === 1 ? 'préstamo' : 'préstamos'}
                </span>
              </div>

              {/* Items del Día */}
              <div className="flex flex-col gap-0">
                {grupo.items.map((item) => (
                  <PrestamoItem
                    key={item.id}
                    item={item}
                    currentTerminalLocal={terminalLocal}
                    onCambiarEstado={handleCambiarEstado}
                    onEliminar={handleEliminarPrestamo}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DEVICE CONFIGURATION MODAL */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        terminalLocal={terminalLocal}
        onSaveTerminalLocal={(loc) => {
          setTerminalLocal(loc);
        }}
        connectedDevices={connectedDevices}
        deviceId={deviceId}
      />
    </div>
  );
}
