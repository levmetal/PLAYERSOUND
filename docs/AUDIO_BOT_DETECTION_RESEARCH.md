# Bot-wall: metodología prestada de hack-skills

Escrito 2026-09-15. Complementa a `docs/AUDIO_BACKEND_BLOCKERS.md` (léelo primero
para el estado técnico completo) — este doc no repite ese contenido, agrega una
lente metodológica extraída de revisar
[`yaklang/hack-skills`](https://github.com/yaklang/hack-skills), una librería de
102 "skills" de metodología ofensiva/pentest pensada para agentes de IA.

## Resumen del bloqueo (una frase)

El resolver de audio (`pages/api/soundplayer/[...termplayer].js`, vía
`youtubei.js`) funciona en local pero en Vercel los 15 clientes InnerTube
probados devuelven `Sign in to confirm you're not a bot`: es el sistema
BotGuard/Proof-of-Origin (PO token) de YouTube penalizando IPs de datacenter, no
un problema de qué cliente se simula — ver detalle completo en
`AUDIO_BACKEND_BLOCKERS.md`.

## Qué es hack-skills y por qué se revisó

`hack-skills` organiza conocimiento de pentest/bug-bounty/CTF en dominios: web/API
security, auth, escalada de privilegios (Linux/Windows/macOS), Active Directory,
mobile, binary exploitation, reversing, cripto, blockchain, AI/ML security,
protocolos de red/pivoting, y forense. **No tiene un skill dedicado a bot
detection / fingerprinting de navegador / BotGuard / Akamai Bot Manager /
PerimeterX / DataDome** — es genérico, no una receta lista para este caso
puntual. Lo que sí aporta es la *forma de trabajar* de quien lidia a diario con
sistemas que intentan distinguir tráfico automatizado de humano, que es
exactamente la naturaleza del problema con YouTube.

De los ~102 skills, se descartaron por no aplicar: todo lo de Active Directory,
mobile pentesting, blockchain/smart contracts, forense de memoria, esteganografía,
criptoanálisis clásico/RSA/lattice, y explotación binaria pura (heap, ROP, kernel,
V8/browser RCE) — apuntan a comprometer sistemas, no a evadir detección de
automatización en un cliente HTTP legítimo. `ai-ml-security` tampoco aplica: cubre
ataques a modelos (pickle RCE, adversarial examples), no bots/scraping.

## Mapeo: skill → técnica aplicable

### `recon-and-methodology` — sistematizar antes de concluir

El skill insiste en que la mayoría de hallazgos vienen de **cobertura
sistemática**, no de un payload clever aislado: baseline → variante → comparar
respuesta, repetido metódicamente. Es literalmente lo que ya se hizo acá (probar
los 15 clientes InnerTube desde el propio deploy de Vercel), y es la razón por la
que el checklist de `AUDIO_BACKEND_BLOCKERS.md` termina insistiendo en "no asumir
que un fix funciona con una sola request exitosa — reintentar contra múltiples
videos y múltiples requests". Vale la pena tomarlo literal: cualquier solución
candidata (PO token sidecar, proxy, cookies) se valida con el mismo protocolo de
15 clientes × múltiples videos × requests repetidas, no con un solo request
exitoso.

### `waf-bypass-techniques` — identificar la señal antes de evadirla

Su "Phase 0" es: no intentes bypasses a ciegas, primero identificá *qué* motor de
detección estás enfrentando y qué señal usa (headers de respuesta, comportamiento,
página de bloqueo). Aplicado acá: antes de invertir tiempo en una solución,
convendría aislar qué señal específica dispara el bloqueo — ¿es solo reputación de
IP?, ¿ausencia de PO token?, ¿fingerprint TLS/JA3?, ¿un header faltante que sólo un
browser real manda? El propio `AUDIO_BACKEND_BLOCKERS.md` ya concluyó (vía
investigación web) que es predominantemente IP + PO token, pero no está probado
de forma aislada cuál de los dos pesa más — eso cambia qué opción priorizar.

El `WAF_PRODUCT_MATRIX.md` (sección Akamai) documenta el patrón "IP rotation
avoids behavioral blocks" y el concepto de "penalty box" (una IP que dispara el
bloqueo queda penalizada un rato) — es la misma lógica de fondo detrás de la
opción 3 del blocker doc (proxy residencial/rotativo) y explica por qué reintentar
desde la misma IP de Vercel una y otra vez no va a cambiar el resultado aunque se
cambie el cliente InnerTube.

### `tunneling-and-pivoting` — para el test barato pendiente

El blocker doc deja como primer ítem del checklist, "cheap and worth ruling out
first": probar si la IP de Render escapa al bloqueo. Este skill da el vocabulario
y las herramientas (`ssh -D` + SOCKS, ProxyChains, Chisel) para probar tráfico
saliente desde distintos rangos de IP sin necesariamente desplegar un servicio
completo en cada uno — se puede usar un túnel SOCKS a través de una instancia
barata en cada proveedor y correr el mismo diagnóstico de 15 clientes a través de
cada túnel, comparando resultados antes de comprometerse a una arquitectura.

### `code-obfuscation-deobfuscation` + `anti-debugging-techniques` — el mapeo más directo

Estos dos skills tratan sobre binarios/código fuertemente ofuscado que conviene
**ejecutar en un entorno controlado (dinámicamente) en vez de reversear
estáticamente** — hookear la rutina de "decrypt"/generación en vez de reimplementar
el algoritmo a mano. BotGuard (el challenge JS de YouTube que emite el PO token)
es exactamente ese caso: JS deliberadamente ofuscado y que cambia con frecuencia.
La estrategia que usa `bgutil-ytdlp-pot-provider` (opción 1 del blocker doc) es
precisamente esta filosofía aplicada: no reimplementa el algoritmo de BotGuard,
lo **ejecuta** en un sandbox JS y extrae el token resultante — la misma lógica de
"emular en vez de deobfuscar" que documentan estos skills para binarios nativos.
Esto no cambia la decisión ya tomada en el blocker doc (el PO token sidecar seguía
siendo la opción más sólida), pero sí confirma *por qué* es el enfoque
técnicamente correcto en vez de una alternativa ad-hoc: no hay atajo estático,
hay que ejecutar el challenge real.

## Qué NO aporta hack-skills acá

- No hay un skill de "browser fingerprinting evasion" (Canvas/WebGL fingerprint,
  `navigator.webdriver`, TLS JA3/JA4 spoofing) — sería el más relevante si se
  optara por automatizar un browser real en vez de un sidecar JS liviano, pero no
  está cubierto.
- No hay nada sobre economía de proxies residenciales (proveedores, costos,
  calidad de IP) — la opción 3 del blocker doc queda sin más soporte metodológico
  que el que ya tenía.
- El repo asume siempre un contexto de autorización explícita para pentest; no es
  el marco correcto para decidir si automatizar contra YouTube viola sus Términos
  de Servicio — esa es una decisión de producto/legal del usuario, no algo que
  este repo (ni este documento) resuelve.

## Recomendación

No cambia la priorización que ya estaba en `AUDIO_BACKEND_BLOCKERS.md` — la
refuerza:

1. Primero, el test barato: réplica del diagnóstico de 15 clientes tunelizando
   tráfico por la IP de Render (usando `tunneling-and-pivoting` como caja de
   herramientas) antes de construir nada.
2. Si sigue bloqueado, prototipar el sidecar PO token — con la confianza extra de
   que "ejecutar el challenge real" (no reimplementarlo) es la estrategia correcta
   según la misma lógica que usan `code-obfuscation-deobfuscation` /
   `anti-debugging-techniques` para cualquier desafío ofuscado dinámico.
3. Validar cualquier resultado con el protocolo sistemático de
   `recon-and-methodology`: múltiples clientes × múltiples videos × requests
   repetidas, nunca una sola request exitosa como prueba de éxito.

El checklist accionable con pasos concretos sigue siendo el de
`AUDIO_BACKEND_BLOCKERS.md` — este documento es research/mapeo, no un plan de
implementación nuevo.
