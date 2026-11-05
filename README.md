# Burning Bull · Operaciones

Aplicación compartida de proyectos, inventario y cotización para Burning Bull Stunts. Evolución del MVP [Juanes2424/sisemp_proyecto](https://github.com/Juanes2424/sisemp_proyecto), commit `0a93187`, conservando React y TypeScript.

## Qué funciona

- Acceso real por invitación, contraseña personal, sesión con cookie HttpOnly y permisos comprobados en el servidor.
- Producción: proyectos, desglose por escena y reservas por fechas. Bodega: catálogo, ingresos, revisiones, actas de salida y devoluciones parciales. Compras: proveedores, solicitudes y ofertas manuales. Gerencia: aprobación, auditoría y administración de cuentas.
- Disponibilidad por fechas, saldos físicos, unidades fuera y en revisión. Una devolución con novedad pasa a revisión y no aumenta el stock disponible.
- Transacciones PostgreSQL para evitar sobreasignaciones simultáneas. Claves de idempotencia para no duplicar ingresos, salidas o devoluciones al reintentar una solicitud.
- Impresión de actas, búsqueda, filtros y navegación adaptable.

## Arquitectura

```text
src/app/                  Sesión, estado remoto y composición
src/domains/access/       Política de permisos
src/domains/inventory/    Disponibilidad física y reservas
src/domains/projects/     Reglas del proyecto y compromisos
src/domains/procurement/  Cobertura y totales de cotización
src/domains/shared/       Tipos, esquemas, comandos y muestra inicial
src/pages/                Recorridos de la interfaz
server/access/            Contraseñas, sesiones, invitaciones y miembros
server/commands.ts        Transacciones, permisos e idempotencia
server/migrations/        Esquema versionado de PostgreSQL
```

La API Express y PostgreSQL viven en Railway. Vercel sirve el frontend y reenvía `/api` al backend. La base no tiene un proxy público. Los datos operativos se guardan en un agregado JSONB por espacio de trabajo; `SELECT FOR UPDATE` serializa sus modificaciones. Usuarios, sesiones, invitaciones, solicitudes idempotentes y auditoría tienen tablas separadas. Para el tamaño actual esto mantiene el modelo sencillo; un volumen mayor requeriría normalizar las entidades y paginar consultas.

## Desarrollo

Node **22.12 o posterior**, PostgreSQL y npm:

```sh
npm ci
cp .env.example .env.local
# Configura una base dedicada y APP_ORIGIN en .env.local.
node --env-file=.env.local --import tsx server/migrate.ts
node --env-file=.env.local --import tsx server/index.ts
# En otra terminal:
npm run dev
```

Vite usa `http://127.0.0.1:5173` y reenvía `/api` a `http://127.0.0.1:3000`. El servidor inicializa la muestra solo si el espacio está vacío; reiniciar o desplegar no restaura ni borra datos.

Primera cuenta (en local o por SSH dentro del servicio Railway):

```sh
npm run db:bootstrap -- --email gerente@empresa.com
```

El enlace privado se escribe en `.secrets/bootstrap.json`, nunca en el registro. Al abrirlo, el gerente establece su contraseña (12–128 caracteres). Luego crea invitaciones desde Equipo y accesos. No hay registro abierto ni contraseñas predeterminadas. La configuración inicial en el despliegue usa una invitación de arranque de un solo uso, descrita en [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Verificación

```sh
npm test
npm run build
# Para ejecutar también las pruebas reales PostgreSQL/HTTP, usa DOS bases de prueba VACÍAS:
TEST_DATABASE_URL=postgresql://localhost/bb_auth_test \
TEST_APP_DATABASE_URL=postgresql://localhost/bb_api_test npm test
```

Las pruebas de integración vacían sus bases dedicadas. **No apuntarlas a producción.** El resto de las pruebas se ejecuta sin una base; las integraciones se marcan omitidas cuando no se configuran.

## Datos y límites

El catálogo inicial es una muestra acotada de `STUNTS INVENTARIO UNIFICADO`, consultada el 5 de noviembre de 2026. Se normalizaron nombres y categorías; los proyectos, movimientos y saldos operativos son ilustrativos. La app no sincroniza ni modifica el Sheet. Los datos compartidos empiezan desde esa muestra y las operaciones posteriores se guardan en PostgreSQL.

Las ofertas se registran manualmente; guardar una solicitud no envía correos. No hay conexión Siigo, compras automáticas ni certificación de seguridad del equipo. La validación del prototipo con el usuario de la empresa debe realizarla el grupo antes de la sustentación.

Para despliegue y operación: [DEPLOYMENT.md](docs/DEPLOYMENT.md). Para la demostración: [DEMO.md](docs/DEMO.md).
