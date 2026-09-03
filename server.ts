import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';

interface User {
  id: string;
  nombre: string;
  rol: string;
  localAsignado?: string;
  telefono?: string;
  fechaCreacion: string;
}

interface Prestamo {
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
  estado: 'PENDIENTE' | 'DEBE' | 'ENTREGADO';
  usuarioId?: string;
  usuarioNombre?: string;
}

interface ActiveDevice {
  deviceId: string;
  local: string;
  usuarioNombre: string;
  lastSeen: number;
}

interface DatabaseSchema {
  users: User[];
  prestamos: Prestamo[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure directory and database file exist
function initDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData: DatabaseSchema = {
      users: [
        {
          id: 'user-admin-1',
          nombre: 'Juan Pérez',
          rol: 'Administrador',
          telefono: '3001234567',
          fechaCreacion: new Date().toLocaleDateString('es-CO'),
        },
        {
          id: 'user-vendedor-1',
          nombre: 'María Gómez',
          rol: 'Vendedora / Local',
          telefono: '3109876543',
          fechaCreacion: new Date().toLocaleDateString('es-CO'),
        },
      ],
      prestamos: [
        {
          id: 'p-seed-1',
          esVoz: false,
          cantidad: 3,
          descripcion: 'Cargadores Tipo C',
          local: 'Local 102',
          fechaHora: new Date().toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
          }),
          estado: 'PENDIENTE',
          usuarioId: 'user-admin-1',
          usuarioNombre: 'Juan Pérez',
        },
        {
          id: 'p-seed-2',
          esVoz: true,
          textoCompleto: '2 taladros percutores prestados al local 45',
          fechaHora: new Date().toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
          }),
          estado: 'DEBE',
          usuarioId: 'user-vendedor-1',
          usuarioNombre: 'María Gómez',
        },
      ],
    };
    saveDatabase(defaultData);
    return defaultData;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file, resetting with defaults:', err);
    const fallback: DatabaseSchema = { users: [], prestamos: [] };
    saveDatabase(fallback);
    return fallback;
  }
}

function saveDatabase(data: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = path.join(DATA_DIR, `db-${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // In-memory cache synced with disk
  let db = initDatabase();

  // Active connected devices (terminals)
  const activeDevices = new Map<string, ActiveDevice>();

  // API Health & Database Status
  app.get('/api/health', (req, res) => {
    // Purge devices that haven't sent a heartbeat in 35s
    const now = Date.now();
    for (const [id, dev] of activeDevices.entries()) {
      if (now - dev.lastSeen > 35000) {
        activeDevices.delete(id);
      }
    }

    res.json({
      status: 'ok',
      database: 'connected',
      storagePath: DB_FILE,
      totalUsers: db.users.length,
      totalPrestamos: db.prestamos.length,
      connectedDevicesCount: activeDevices.size,
      connectedDevices: Array.from(activeDevices.values()),
    });
  });

  // Heartbeat endpoint for multi-device live sync
  app.post('/api/heartbeat', (req, res) => {
    const { deviceId, local, usuarioNombre } = req.body;
    if (deviceId) {
      activeDevices.set(deviceId, {
        deviceId,
        local: local || 'General',
        usuarioNombre: usuarioNombre || '',
        lastSeen: Date.now(),
      });
    }

    // Cleanup stale devices
    const cutoff = Date.now() - 35000;
    for (const [id, dev] of activeDevices.entries()) {
      if (dev.lastSeen < cutoff) {
        activeDevices.delete(id);
      }
    }

    res.json({
      success: true,
      activeDevices: Array.from(activeDevices.values()),
      serverTime: Date.now(),
    });
  });

  app.get('/api/devices', (req, res) => {
    const cutoff = Date.now() - 35000;
    for (const [id, dev] of activeDevices.entries()) {
      if (dev.lastSeen < cutoff) {
        activeDevices.delete(id);
      }
    }
    res.json(Array.from(activeDevices.values()));
  });

  // --- USERS API ---
  app.get('/api/users', (req, res) => {
    res.json(db.users);
  });

  app.post('/api/users', (req, res) => {
    try {
      const { nombre, rol, telefono, localAsignado } = req.body;
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre del usuario es requerido.' });
      }

      const newUser: User = {
        id: `user-${uuidv4()}`,
        nombre: nombre.trim(),
        rol: (rol && rol.trim()) || 'Operador',
        localAsignado: localAsignado ? localAsignado.trim() : undefined,
        telefono: telefono ? telefono.trim() : undefined,
        fechaCreacion: new Date().toLocaleDateString('es-CO'),
      };

      db.users.push(newUser);
      saveDatabase(db);
      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Error al guardar el usuario en la base de datos.' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const initialCount = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    if (db.users.length !== initialCount) {
      saveDatabase(db);
      res.json({ success: true, message: 'Usuario eliminado' });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  });

  // --- PRESTAMOS API ---
  app.get('/api/prestamos', (req, res) => {
    res.json(db.prestamos);
  });

  app.post('/api/prestamos', (req, res) => {
    try {
      const {
        esVoz,
        textoCompleto,
        cantidad,
        descripcion,
        local,
        origenTerminal,
        fechaHora,
        foto,
        estado = 'PENDIENTE',
        usuarioId,
        usuarioNombre,
      } = req.body;

      const newPrestamo: Prestamo = {
        id: `loan-${uuidv4()}`,
        esVoz: Boolean(esVoz),
        textoCompleto: textoCompleto ? textoCompleto.trim() : undefined,
        cantidad: cantidad !== undefined ? cantidad : undefined,
        descripcion: descripcion ? descripcion.trim() : undefined,
        local: local ? local.trim() : undefined,
        origenTerminal: origenTerminal ? origenTerminal.trim() : undefined,
        foto: foto ? String(foto) : undefined,
        fechaHora: fechaHora || new Date().toLocaleString('es-CO', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        }),
        createdAt: req.body.createdAt || Date.now(),
        fechaIso: req.body.fechaIso || new Date().toISOString(),
        estado: estado || 'PENDIENTE',
        usuarioId: usuarioId || undefined,
        usuarioNombre: usuarioNombre || undefined,
      };

      // Unshift to put newest first
      db.prestamos.unshift(newPrestamo);
      saveDatabase(db);
      res.status(201).json(newPrestamo);
    } catch (error) {
      console.error('Error creating prestamo:', error);
      res.status(500).json({ error: 'Error al registrar el préstamo en la base de datos.' });
    }
  });

  app.patch('/api/prestamos/:id', (req, res) => {
    const { id } = req.params;
    const item = db.prestamos.find(p => p.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    if (req.body.estado !== undefined) {
      item.estado = req.body.estado;
    }
    if (req.body.cantidad !== undefined) {
      item.cantidad = req.body.cantidad;
    }
    if (req.body.descripcion !== undefined) {
      item.descripcion = req.body.descripcion;
    }
    if (req.body.local !== undefined) {
      item.local = req.body.local;
    }

    saveDatabase(db);
    res.json(item);
  });

  app.delete('/api/prestamos/:id', (req, res) => {
    const { id } = req.params;
    const initialCount = db.prestamos.length;
    db.prestamos = db.prestamos.filter(p => p.id !== id);
    if (db.prestamos.length !== initialCount) {
      saveDatabase(db);
      res.json({ success: true, message: 'Préstamo eliminado' });
    } else {
      res.status(404).json({ error: 'Préstamo no encontrado' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
}

startServer();
