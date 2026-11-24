-- ============================================================================
-- Datos iniciales ficticios (Asunción y Gran Asunción, Paraguay)
-- Incluye ubicaciones reales para OpenStreetMap y exportación a Google Maps
-- ============================================================================

INSERT INTO empresas (nombre, rubro, ciudad, direccion, latitud, longitud) VALUES
  ('Guaraní Sistemas S.A.', 'Tecnología y Software', 'Asunción', 'Av. España 1240, Villa Morra', -25.291820, -57.580640),
  ('Itapúa Logística Integral', 'Logística y Transporte', 'Asunción', 'Av. Artigas 1920, Trinidad', -25.263450, -57.593120),
  ('Clínica Central Escalada', 'Salud y Laboratorio', 'Asunción', 'Av. Colón 685, Centro', -25.284910, -57.641380),
  ('Paraná Ingeniería Eléctrica', 'Hardware e Infraestructura', 'San Lorenzo', 'Ruta Mariscal Estigarribia Km 10', -25.339710, -57.523410),
  ('Banco del Este S.A.', 'Finanzas y Administración', 'Asunción', 'Av. Aviadores del Chaco 2050, Carmelitas', -25.282790, -57.564110),
  ('Agroindustria Ypacaraí', 'Producción e Industria', 'Luque', 'Av. Gral. Aquino 840, Centro Luque', -25.268320, -57.487930)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO vacantes (empresa_id, cargo, descripcion, cierre, cupos, estado) VALUES
  (1, 'Desarrollador Web Junior', 'Mantenimiento de módulos React, APIs REST y consultas SQL en PostgreSQL.', '2026-12-30', 2, 'abierta'),
  (1, 'Soporte Técnico de Laboratorio', 'Diagnóstico de hardware, redes LAN y configuración de estaciones de trabajo.', '2026-12-20', 1, 'abierta'),
  (2, 'Auxiliar de Control de Flota', 'Seguimiento de rutas, registro de entregas y control documental.', '2026-12-18', 2, 'abierta'),
  (3, 'Recepcionista de Turno Mañana', 'Atención al paciente, carga de órdenes de laboratorio y archivo.', '2026-12-28', 2, 'abierta'),
  (4, 'Técnico en Redes y Cableado', 'Instalación de racks, puntos de red UTP/fibra y certificación de enlaces.', '2026-12-22', 1, 'abierta'),
  (5, 'Analista de Datos Jr.', 'Generación de tableros de control y validación de registros financieros.', '2026-11-10', 2, 'abierta'),
  (6, 'Operador de Control de Calidad', 'Inspección de lotes en planta y registro de conformidad.', '2026-12-15', 1, 'cerrada');

INSERT INTO candidatos (documento, nombre, email, telefono) VALUES
  ('5124890', 'Lucas Benítez', 'lucas.benitez@ejemplo.py', '+595 981 210 340'),
  ('5439120', 'Sofía Villalba', 'sofia.villalba@ejemplo.py', '+595 971 452 118'),
  ('4982311', 'Mateo Coronel', 'mateo.coronel@ejemplo.py', '+595 982 664 092'),
  ('5610442', 'Camila Duarte', 'camila.duarte@ejemplo.py', '+595 985 330 715'),
  ('5290874', 'Thiago Giménez', 'thiago.gimenez@ejemplo.py', '+595 972 889 401'),
  ('5341908', 'Valentina Acosta', 'valentina.acosta@ejemplo.py', '+595 984 512 630');

INSERT INTO postulaciones (vacante_id, candidato_id, fecha, estado, motivo_decision) VALUES
  (1, 1, '2026-11-20T09:15:00Z', 'seleccionado', 'Seleccionado dentro del cupo (1/2) tras validación de perfil.'),
  (1, 2, '2026-11-21T10:30:00Z', 'pendiente', 'Postulación aceptada dentro de fecha de cierre.'),
  (2, 3, '2026-11-21T14:00:00Z', 'pendiente', 'Postulación aceptada dentro de fecha de cierre.'),
  (2, 5, '2026-11-22T08:45:00Z', 'pendiente', 'Postulación aceptada dentro de fecha de cierre.'),
  (3, 4, '2026-11-22T11:20:00Z', 'seleccionado', 'Seleccionado dentro del cupo (1/2).'),
  (4, 6, '2026-11-23T09:00:00Z', 'pendiente', 'Postulación aceptada dentro de fecha de cierre.')
ON CONFLICT (vacante_id, candidato_id) DO NOTHING;
