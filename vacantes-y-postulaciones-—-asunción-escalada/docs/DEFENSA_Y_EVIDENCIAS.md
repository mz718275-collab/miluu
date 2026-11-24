# Evidencias y Guía de Defensa — Proyecto Individual 22

**Institución:** Colegio Nacional EMD Asunción Escalada  
**Proyecto:** 22 · Vacantes y postulaciones  
**Estudiante:** Santacruz Cubilla, Marcos Damian  
**Curso / Sección / Turno:** Segundo curso · Tercera sección · Turno mañana  
**Puntaje:** Software 8 pts · Hardware 8 pts · Laboratorio 8 pts  

---

## 1. Relación entre tablas (Modelo Entidad-Relación)

El sistema implementa cuatro entidades normalizadas en PostgreSQL / Supabase (`empresas`, `vacantes`, `candidatos` y `postulaciones`), todas con identificador primario (`id`), claves foráneas con restricción referencial (`ON DELETE RESTRICT`) y marcas temporales automáticas (`created_at`, `updated_at`):

1. **`empresas` (1) ──▶ (N) `vacantes`**  
   Cada registro de `vacantes` referencia a `empresas.id` mediante `empresa_id`. No es posible eliminar una empresa mientras tenga vacantes asociadas, garantizando integridad referencial y trazabilidad del rubro y ubicación geográfica (`latitud`, `longitud` en OpenStreetMap y Google Maps).
2. **`vacantes` (1) ──▶ (N) `postulaciones` ◀── (1) `candidatos`**  
   La tabla `postulaciones` resuelve la relación muchos-a-muchos entre `vacantes` y `candidatos` mediante `vacante_id` y `candidato_id`, incorporando una restricción única compuesta `UNIQUE (vacante_id, candidato_id)` para impedir postulaciones duplicadas del mismo candidato a una misma oferta.

---

## 2. Regla avanzada explicada con datos del proyecto

**Control estricto de cupos, cierre y concurrencia (`seleccionar_postulacion_segura` / Mutex por vacante):**

- **Caso real con los datos sembrados:**  
  La vacante **"Soporte Técnico de Laboratorio"** en **Guaraní Sistemas S.A.** tiene `cupos = 1`, `estado = 'abierta'` y dos postulantes en estado `pendiente`: **Mateo Coronel** (CI `4982311`) y **Thiago Giménez** (CI `5290874`).
- **Regla de negocio:**  
  1. Antes de seleccionar, el sistema verifica que la vacante esté `abierta` y cuenta las postulaciones con `estado = 'seleccionado'`.
  2. Para evitar condiciones de carrera cuando dos administradores (o dos solicitudes simultáneas vía `Promise.all`) intentan seleccionar al mismo tiempo el **último cupo disponible** (`cupos = 1`), el backend adquiere un **bloqueo exclusivo por `vacante_id`** (mutex transaccional en memoria en modo local o `SELECT ... FOR UPDATE` en PostgreSQL/Supabase).
  3. La primera transacción confirma `seleccionados = 0 < 1`, cambia a Mateo Coronel a `seleccionado` (`1/1`) y libera el bloqueo. La segunda transacción lee el estado actualizado (`seleccionados = 1 >= 1`) y **rechaza la operación** con HTTP `409 Conflict` explicando: *"Cupos completos (1/1 seleccionados)"*.
- **Bloqueo fuera de cierre:**  
  La vacante **"Analista de Datos Jr."** en **Banco del Este S.A.** tiene fecha `cierre = 2026-11-10`. Cualquier intento de postulación posterior recibe HTTP `422` indicando exactamente la fecha límite vencida.

---

## 3. Despliegue en Render, GitHub y Supabase

1. **Supabase:** Ejecutar `supabase/schema.sql` y `supabase/seed.sql` en el SQL Editor de Supabase. Copiar `DATABASE_URL` (o `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
2. **GitHub:** Subir el repositorio completo (incluyendo `render.yaml`, `server.ts`, `supabase/` y `src/`).
3. **Render:** Crear un Web Service conectado al repositorio de GitHub usando `render.yaml` (`npm install && npm run build` / `npm start`) y configurar las variables de entorno en Render Dashboard.
