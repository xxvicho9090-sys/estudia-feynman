# Estudia con Feynman — reconstrucción desde cero (diseño)

Fecha: 2026-10-19 · Estado: pendiente de revisión del usuario

## Propósito
Estudiar un ramo explicando cada concepto con palabras propias (técnica Feynman). La app compara la explicación con el material del propio usuario, **sin internet ni IA**, muestra qué ideas se cubrieron y cuáles faltaron, y agenda el repaso. Es la misma función de la app actual, reescrita limpia y reducida a lo esencial.

## Decisiones del usuario
- Núcleo perfecto: ciclo Feynman (explicar → corrección → repaso). Extras que vuelven: **solo repaso espaciado** (+ progreso por ramo). Se descartan: Millonario, Buzz, quiz, flashcards sueltas, usuarios múltiples, nube, exportar PDF.
- Evaluación **100 % offline**; no hay claves ni servidor de IA.
- Material: PDF/Word subido por el usuario, partido por secciones; el usuario revisa y edita.
- App nueva **desde cero** (no se migran datos de la app vieja).
- Base: **React + Vite**, Capacitor (Android) y web; actualizaciones OTA existentes (Capgo + Render). Mismo repo, servicio Render y firma: se instala encima del APK actual.

## Pantallas
1. **Hoy**: conceptos que toca repasar, racha, acceso rápido a una sesión.
2. **Ramos**: ramo → tema → concepto, con progreso por nivel.
3. **Importar**: subir PDF/Word → propuesta de conceptos (por títulos y definiciones) → el usuario edita, fusiona, divide, borra o agrega a mano → guardar.
4. **Sesión Feynman**: (a) solo se ve el nombre del concepto; (b) explicación por dictado de voz o texto; (c) resultado: ideas cubiertas, ideas que faltaron, frases dichas que no aparecen en el material, con el texto de referencia al lado; (d) el usuario se califica (difícil / bien / fácil) y puede dejar una nota; (e) se agenda el próximo repaso.
5. **Repaso**: cola diaria con el mismo ciclo.
6. **Ajustes y datos**: tema claro/oscuro, copia de seguridad (exportar/importar JSON), versión y estado de actualización.

## Arquitectura (módulos con una sola responsabilidad)
- `parse/`: extrae texto de PDF (pdf.js) y Word (.docx) y lo parte en conceptos (títulos, definiciones "X es…", listas). Entrada: archivo. Salida: lista de {nombre, referencia}.
- `evaluate/`: dada la referencia y la explicación (español), calcula cobertura de ideas (normalización, raíces de palabras, sinónimos tomados del propio material) → {ideasCubiertas, ideasFaltantes, extras, puntaje}. Función pura, probada con casos.
- `srs/`: repaso espaciado tipo SM-2 con la autocalificación y el puntaje como entradas. Función pura, probada.
- `store/`: IndexedDB local por dispositivo (ramos, temas, conceptos, intentos, calendario de repaso). Ningún dato sale del teléfono.
- `ui/`: componentes React por pantalla; estado mínimo, sin lógica de negocio.
- `ota/`: módulo de actualización existente (src/ota.js), sin cambios de comportamiento.

## Flujo de datos
Archivo → `parse` → conceptos editables → `store`. Sesión: concepto → explicación → `evaluate` → autocalificación → `srs` → `store` (próxima fecha) → pantalla Hoy/Repaso.

## Manejo de errores
- PDF sin texto (escaneado): aviso claro, se permite pegar texto o crear conceptos a mano.
- Documento sin títulos/definiciones detectables: se ofrece partir por párrafos.
- Dictado de voz no disponible: se cae a escribir.
- Sin almacenamiento disponible: mensaje y copia de seguridad.

## Límite conocido (honesto)
La evaluación mide cobertura de ideas del documento, no comprende el sentido: puede fallar con paráfrasis muy libres. Por eso la referencia se muestra al lado y la calificación final es del usuario.

## Pruebas
- Pruebas automáticas de `evaluate` y `srs` (casos en español con aciertos, omisiones y paráfrasis).
- Recorrido completo en navegador: importar → editar conceptos → sesión → repaso → copia de seguridad.
- APK: compilación firmada y verificación de firma; funciones nativas (dictado) a confirmar en el teléfono.

## Fuera de alcance (YAGNI)
IA externa, servidor propio, cuentas/usuarios, nube, juegos, quiz, exportar a PDF, migración de datos antiguos.
