-- ============================================================================
-- Proyecto Individual 22: Vacantes y Postulaciones
-- Colegio Nacional EMD Asunción Escalada
-- Estudiante: Santacruz Cubilla, Marcos Damian (2° Curso · 3ª Sección · TM)
-- Esquema PostgreSQL / Supabase con integridad referencial, marcas temporales,
-- prevención de duplicados y control transaccional de cupos por concurrencia.
-- ============================================================================

-- Función trigger para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabla EMPRESAS (incluye geolocalización para OpenStreetMap y Google Maps)
CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  rubro VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100) NOT NULL DEFAULT 'Asunción',
  direccion VARCHAR(220) NOT NULL DEFAULT '',
  latitud NUMERIC(9, 6) NOT NULL DEFAULT -25.286460,
  longitud NUMERIC(9, 6) NOT NULL DEFAULT -57.647000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_empresas_nombre UNIQUE (nombre)
);

CREATE TRIGGER trg_empresas_updated_at
BEFORE UPDATE ON empresas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Tabla VACANTES
CREATE TABLE IF NOT EXISTS vacantes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  cargo VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  cierre DATE NOT NULL,
  cupos INTEGER NOT NULL CHECK (cupos > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacantes_empresa ON vacantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vacantes_estado ON vacantes(estado);
CREATE INDEX IF NOT EXISTS idx_vacantes_cierre ON vacantes(cierre);

CREATE TRIGGER trg_vacantes_updated_at
BEFORE UPDATE ON vacantes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Tabla CANDIDATOS
CREATE TABLE IF NOT EXISTS candidatos (
  id SERIAL PRIMARY KEY,
  documento VARCHAR(40) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(160) NOT NULL DEFAULT '',
  telefono VARCHAR(50) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_candidatos_documento UNIQUE (documento)
);

CREATE TRIGGER trg_candidatos_updated_at
BEFORE UPDATE ON candidatos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Tabla POSTULACIONES
CREATE TABLE IF NOT EXISTS postulaciones (
  id SERIAL PRIMARY KEY,
  vacante_id INTEGER NOT NULL REFERENCES vacantes(id) ON DELETE RESTRICT,
  candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE RESTRICT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'seleccionado', 'rechazado')),
  motivo_decision TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_postulacion_unica UNIQUE (vacante_id, candidato_id)
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_vacante ON postulaciones(vacante_id);
CREATE INDEX IF NOT EXISTS idx_postulaciones_candidato ON postulaciones(candidato_id);
CREATE INDEX IF NOT EXISTS idx_postulaciones_estado ON postulaciones(estado);

CREATE TRIGGER trg_postulaciones_updated_at
BEFORE UPDATE ON postulaciones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Función transaccional anti-concurrencia para seleccionar sin superar cupos
CREATE OR REPLACE FUNCTION seleccionar_postulacion_segura(p_postulacion_id INTEGER)
RETURNS TABLE(aceptado BOOLEAN, codigo TEXT, mensaje TEXT) AS $$
DECLARE
  v_vacante_id INTEGER;
  v_vacante_estado VARCHAR(20);
  v_cupos INTEGER;
  v_seleccionados INTEGER;
  v_post_estado VARCHAR(20);
BEGIN
  -- Obtener vacante_id y estado actual de la postulación
  SELECT vacante_id, estado INTO v_vacante_id, v_post_estado
  FROM postulaciones
  WHERE id = p_postulacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'NOT_FOUND', 'Postulación no encontrada.';
    RETURN;
  END IF;

  -- Bloqueo exclusivo a nivel de fila sobre la vacante para serializar solicitudes simultáneas
  SELECT estado, cupos INTO v_vacante_estado, v_cupos
  FROM vacantes
  WHERE id = v_vacante_id
  FOR UPDATE;

  IF v_vacante_estado = 'cerrada' THEN
    RETURN QUERY SELECT FALSE, 'VACANCY_CLOSED', 'Rechazado: La vacante se encuentra cerrada.';
    RETURN;
  END IF;

  IF v_post_estado = 'seleccionado' THEN
    RETURN QUERY SELECT TRUE, 'ALREADY_SELECTED', 'El candidato ya se encontraba seleccionado.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_seleccionados
  FROM postulaciones
  WHERE vacante_id = v_vacante_id AND estado = 'seleccionado';

  IF v_seleccionados >= v_cupos THEN
    RETURN QUERY SELECT FALSE, 'QUOTA_EXCEEDED',
      format('Rechazado: Cupos completos (%s/%s seleccionados).', v_seleccionados, v_cupos);
    RETURN;
  END IF;

  UPDATE postulaciones
  SET estado = 'seleccionado',
      motivo_decision = format('Seleccionado dentro del cupo (%s/%s).', v_seleccionados + 1, v_cupos)
  WHERE id = p_postulacion_id;

  RETURN QUERY SELECT TRUE, 'SELECTED',
    format('Aceptado: Candidato seleccionado (%s/%s cupos ocupados).', v_seleccionados + 1, v_cupos);
END;
$$ LANGUAGE plpgsql;

-- 6. Seguridad de Nivel de Fila (RLS) para Supabase
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE postulaciones ENABLE ROW LEVEL SECURITY;

-- Lectura autorizada para usuario de consulta sobre empresas y vacantes
CREATE POLICY "Lectura publica empresas" ON empresas FOR SELECT USING (true);
CREATE POLICY "Lectura publica vacantes" ON vacantes FOR SELECT USING (true);

-- Solo el servidor con service_role opera mutaciones y accede a documentos completos de candidatos
CREATE POLICY "Solo servicio gestiona candidatos" ON candidatos FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Solo servicio gestiona postulaciones" ON postulaciones FOR ALL USING (auth.role() = 'service_role');
