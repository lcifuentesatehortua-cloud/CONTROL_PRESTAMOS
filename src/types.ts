export type EstadoPrestamo = 'PENDIENTE' | 'DEBE' | 'ENTREGADO';

export interface User {
  id: string;
  nombre: string;
  rol: string;
  localAsignado?: string;
  telefono?: string;
  fechaCreacion: string;
}

export interface Prestamo {
  id: string;
  esVoz: boolean;
  textoCompleto?: string;
  cantidad?: number | string;
  descripcion?: string;
  local?: string;
  origenTerminal?: string;
  fechaHora: string;
  createdAt?: number;
  fechaIso?: string;
  foto?: string;
  estado: EstadoPrestamo;
  usuarioId?: string;
  usuarioNombre?: string;
}

export interface ActiveDevice {
  deviceId: string;
  local: string;
  usuarioNombre?: string;
  lastSeen: number;
}

export interface DatabaseState {
  users: User[];
  prestamos: Prestamo[];
}

