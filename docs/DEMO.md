# Burning Bull · recorrido de demostración

La plataforma usa acceso real por invitación, sesiones en cookies HttpOnly y una base PostgreSQL compartida. Las acciones se validan en el servidor. No existen usuarios de demostración con contraseña pública ni un selector de roles.

1. Activa una cuenta con el enlace privado de invitación de gerencia (`/activar#token=…`). Define nombre y contraseña de al menos 12 caracteres. El enlace vence y se consume una sola vez.
2. En **Resumen**, consulta proyectos, equipos disponibles hoy, salidas pendientes y unidades en revisión.
3. En **Proyectos**, crea un rodaje con cliente, responsable, locación y fechas. Añade materiales por escena. La sección **Equipos y reservas** calcula capacidad para esas fechas y permite reservar solo las unidades propias disponibles.
4. En **Inventario**, busca por código, nombre, marca, categoría o ubicación. Abre la ficha para consultar las reservas y el historial. Bodega puede registrar ingresos, enviar unidades a revisión y devolverlas a disponibilidad después de resolver la revisión.
5. En **Salidas y retornos**, crea una salida desde una reserva pendiente. Indica responsable, retorno previsto, cantidades y verifica los dos pasos del checklist. Una salida requiere equipos preparados y carga verificada.
6. Abre el acta, usa **Imprimir / PDF** y comprueba cantidades entregadas y pendientes. Registra una devolución parcial: separa unidades en buen estado y unidades con novedad. Los daños requieren observación y pasan a revisión; las unidades no recibidas siguen fuera.
7. Para un faltante de proyecto, entra en su **Cotización**. Compras registra una solicitud manual con proveedores y especificaciones; luego carga ofertas recibidas, compara cantidad, entrega, precio total y disponibilidad. Selecciona una oferta suficiente para cada faltante, guarda personal, pólizas y margen y envía a aprobación interna. Gerencia aprueba o rechaza con motivo.
8. Gerencia administra personas en **Equipo y acceso**, crea enlaces privados de invitación y cambia roles o desactiva cuentas. **Actividad** conserva el registro de acciones. Cada persona puede cambiar su contraseña en su cuenta.

## Qué representa la muestra

El catálogo inicial es una muestra acotada basada en el inventario STUNTS consultado durante el diseño. Los saldos, proyectos y movimientos iniciales son ejemplos de operación. No se modifica el archivo fuente ni existe sincronización con Google Sheets. Las acciones nuevas son compartidas entre las cuentas de esta plataforma y permanecen al recargar.

Las solicitudes y respuestas de proveedores se registran manualmente: no se envían correos desde la plataforma. La aprobación no registra una compra ni recibe físicamente equipo. No hay integración con Siigo. El acta es un registro operativo y no certifica la seguridad de un equipo.

## Acceso según responsabilidad

| Rol        | Acciones                                                            |
| ---------- | ------------------------------------------------------------------- |
| Producción | Proyectos, materiales y reservas; consulta de inventario y compras. |
| Bodega     | Catálogo, ingresos, revisión, salidas y retornos.                   |
| Compras    | Proveedores, solicitudes, ofertas y preparación de cotizaciones.    |
| Gerencia   | Todas las acciones, aprobación, personas y auditoría.               |

La aplicación consulta los cambios cada 15 segundos y al volver a la ventana. Los formularios abiertos conservan el borrador; cada acción se valida contra el estado actual del servidor. Una sesión vencida lleva de nuevo al acceso.

## Atribución

Implementación desarrollada sobre el prototipo React/TypeScript de [Juanes2424/sisemp_proyecto](https://github.com/Juanes2424/sisemp_proyecto), commit original `0a93187`. Se conserva el recorrido de desglose, inventario, solicitud y comparación, ampliado con operación compartida.
