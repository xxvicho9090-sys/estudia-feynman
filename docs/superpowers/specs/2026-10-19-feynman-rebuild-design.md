# Estudia con Feynman — reconstrucción desde cero (diseño)

Fecha: 2026-10-19 · Estado: pendiente de aprobación del usuario

## Propósito (lo único que hace)
1. Subir PDFs.
2. La app saca los conceptos.
3. El usuario explica un concepto con sus palabras.
4. La app lo evalúa con **nota de 1 a 7** y una explicación de **qué está bien dicho y qué está mal o falta**.

Nada más: sin repaso espaciado, sin estadísticas, sin juegos, sin quiz, sin flashcards, sin usuarios, sin nube, sin exportar.

## Decisiones del usuario
- App nueva **desde cero** (no se migran datos de la app vieja). Base **React + Vite**, web + APK (Capacitor), actualizaciones OTA existentes. Mismo repo, Render y firma.
- Evaluación y extracción de conceptos: **con IA (Groq)**. Cada persona pega su clave gratis de Groq en la app (se guarda solo en el dispositivo; nunca en el repo ni en Render). Requiere internet.

## Pantallas (solo tres)
1. **Mis PDFs / conceptos**: subir uno o varios PDF; la app lista los conceptos encontrados por PDF. Se puede corregir la lista (renombrar, borrar, fusionar, agregar) porque la extracción automática no es perfecta.
2. **Explicar**: se muestra el nombre del concepto; el usuario explica por dictado de voz o escribiendo y pulsa "Evaluar".
3. **Resultado**: nota 1–7 (escala chilena, 4,0 = aprobado), lista "Bien dicho" (ideas del material que el usuario cubrió), "Mal o faltó" (ideas que no mencionó o dijo distinto) y el texto de referencia al lado. Botón para volver a intentar o pasar al siguiente concepto.

## Arquitectura (módulos de una sola responsabilidad)
- `parse/`: PDF → texto (pdf.js, por trozos) → la IA lista los conceptos con su texto de referencia (JSON). Sin clave o sin internet: respaldo por títulos y definiciones.
- `ai/`: cliente Groq con salida JSON, reintentos y mensajes de error claros (sin clave, sin internet, límite de uso).
- `evaluate/`: (explicación, referencia) → la IA devuelve {bien[], mal[], faltó[], puntaje 0–100}; la **nota 1–7 la calcula la app** con la fórmula fija (no la IA), así es consistente. Función de nota pura y probada.
- `store/`: IndexedDB local (PDFs, conceptos, último resultado). Nada sale del teléfono.
- `ui/`: React, tres pantallas, sin lógica de negocio.
- `ota/`: módulo de actualización existente.

## Nota 1–7
Escala chilena con exigencia 60 %: 4,0 con 60 % de ideas clave cubiertas, 7,0 con 100 %, 1,0 con 0 %. Se redondea a un decimal. La fórmula se documenta en la pantalla de resultado.

## Límites honestos
- La IA puede equivocarse: por eso el resultado muestra siempre el texto de referencia al lado para contrastar.
- Necesita internet y la clave de Groq del usuario; el plan gratis tiene límite de uso por minuto y por día.
- Lo que escribes y el texto del PDF se envían a Groq para evaluarse (no se guarda en ningún servidor propio).

## Manejo de errores
- Sin clave / sin internet / límite de Groq: mensaje claro y reintento; la lista de conceptos se puede hacer a mano.
- PDF escaneado (sin texto): aviso claro; se puede pegar texto o crear conceptos a mano.
- PDF sin títulos/definiciones detectables: se ofrece partir por párrafos.
- Dictado no disponible: se cae a escribir.

## Pruebas
- Automáticas para la fórmula de nota y el parseo de la respuesta JSON de la IA (con respuestas simuladas), y `parse` con PDFs de ejemplo en español; una prueba real contra Groq con la clave del usuario.
- Recorrido completo en navegador: subir PDF → conceptos → explicar → resultado. APK firmado verificado; dictado a confirmar en el teléfono.
