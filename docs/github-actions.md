# GitHub Actions: CI y sincronización de ramas

Este documento explica los workflows de GitHub Actions del repositorio y, lo
más importante, **los pasos manuales que hay que activar en la configuración
de GitHub** para que la convención de ramas quede realmente forzada (los
archivos `.yml` por sí solos no bloquean nada si las ramas no están
protegidas).

## Convención de ramas

```
feature/*  -->  develop   (Pull Request normal, validado por CI + Branch Policy)
develop    -->  main      (Pull Request normal, release)
main       -->  develop   (EXCEPCIÓN: solo el PR automático creado por
                            sync-develop.yml, con autor github-actions[bot])
```

Reglas:
- Nadie hace push directo a `main` ni a `develop`.
- Todo el trabajo nuevo se hace en una rama `feature/<nombre>` creada desde
  `develop`.
- `main` solo se actualiza mediante un PR desde `develop`.
- `develop` solo se actualiza mediante PRs desde `feature/*`, o mediante el
  PR automático `main -> develop` que abre el workflow de sincronización
  después de cada merge a `main`.

## Workflows incluidos

### 1. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
Corre en `pull_request` y `push` hacia `main` y `develop`. Instala
dependencias (`npm ci`) y compila el proyecto (`npm run build`) con Node 18,
igual que la imagen de Docker (`Dockerfile`).

### 2. [`.github/workflows/branch-policy.yml`](../.github/workflows/branch-policy.yml)
Corre en cada `pull_request` cuyo destino (`base`) sea `main` o `develop`.
Bloquea el check si la combinación origen/destino no respeta la convención:
- Hacia `main`: solo se permite `head = develop`.
- Hacia `develop`: solo se permite `head` que empiece por `feature/`, o
  `head = main` **y** que el autor del PR sea `github-actions[bot]` (el PR
  automático de sync).

Este check debe marcarse como **obligatorio** en la protección de rama (ver
más abajo) para que realmente bloquee el merge.

### 3. [`.github/workflows/sync-develop.yml`](../.github/workflows/sync-develop.yml)
Corre en cada `push` a `main` (es decir, después de aceptar el PR
`develop -> main`). Compara `origin/main` con `origin/develop`:
- Si no hay diferencias, no hace nada.
- Si hay diferencias y no existe ya un PR abierto `main -> develop`, crea uno
  nuevo con `gh pr create`.
- Si ya existe un PR abierto `main -> develop`, no crea uno duplicado (el PR
  existente se actualiza solo, porque GitHub sigue el estado de la rama
  `main`).

También se puede disparar manualmente desde la pestaña **Actions** con
`workflow_dispatch` para probarlo sin necesidad de esperar un push a `main`.

## Guía de activación (paso a paso en GitHub)

### 1. Habilitar GitHub Actions en el repositorio
1. Ve a **Settings -> Actions -> General**.
2. En **Actions permissions**, deja seleccionado *Allow all actions and
   reusable workflows* (o, si tu organización restringe esto, permite al
   menos `actions/checkout` y `actions/setup-node`; el resto del trabajo lo
   hace `gh`, que ya viene preinstalado en los runners de GitHub).
3. Guarda los cambios.

### 2. Permitir que Actions abra Pull Requests
Este paso es el que más se suele olvidar y hace fallar `sync-develop.yml`
con un error de permisos al ejecutar `gh pr create`:
1. En la misma página, baja hasta **Workflow permissions**.
2. Selecciona **Read and write permissions**.
3. Marca la casilla **Allow GitHub Actions to create and approve pull
   requests**.
4. Guarda los cambios.

### 3. Ejecutar un primer PR de prueba (para que los checks aparezcan)
Antes de poder marcar los checks como obligatorios en la protección de
rama, GitHub necesita haberlos visto correr al menos una vez:
1. Crea una rama `feature/prueba-ci` desde `develop`.
2. Haz un cambio trivial y súbela.
3. Abre un Pull Request `feature/prueba-ci -> develop`.
4. Confirma en la pestaña **Checks** del PR que corren y pasan:
   - `CI / Instalar dependencias y compilar`
   - `Branch Policy / Validar origen/destino del PR`
5. Puedes cerrar este PR de prueba sin fusionarlo una vez verificado.

### 4. Proteger la rama `main`
1. Ve a **Settings -> Branches -> Branch protection rules -> Add rule**
   (o **Rulesets** si tu repo usa la UI nueva de reglas).
2. **Branch name pattern**: `main`.
3. Activa **Require a pull request before merging**.
4. Activa **Require status checks to pass before merging** y selecciona:
   - `CI / Instalar dependencias y compilar`
   - `Branch Policy / Validar origen/destino del PR`
5. (Recomendado) Activa **Do not allow bypassing the above settings** para
   que ni siquiera administradores puedan hacer push directo.
6. Guarda la regla.

### 5. Proteger la rama `develop`
Repite el paso 4 con **Branch name pattern**: `develop`, con los mismos
checks obligatorios.

Con esto, ni `main` ni `develop` aceptan push directo: todo pasa por PR, y
`branch-policy.yml` bloquea cualquier PR que no siga la convención
(`feature/*  -> develop`, `develop -> main`, o el PR automático
`main -> develop`).

### 6. Probar el ciclo completo
1. Fusiona un PR `feature/algo -> develop` (debe pasar CI + Branch Policy).
2. Abre y fusiona un PR `develop -> main` (debe pasar CI + Branch Policy).
3. Ve a la pestaña **Actions** y confirma que se disparó el workflow
   **Sync main -> develop**.
4. Si había diferencias, debe existir un nuevo Pull Request abierto
   `main -> develop`, creado por `github-actions[bot]`.
5. Revisa ese PR y fusiónalo para que `develop` quede igual a `main`.

### 7. (Opcional) Auto-merge del PR de sincronización
Si prefieres que el PR `main -> develop` se fusione solo sin revisión
manual:
1. Ve a **Settings -> General -> Pull Requests** y activa **Allow
   auto-merge**.
2. Añade un paso adicional en `sync-develop.yml` después de crear el PR:
   ```bash
   gh pr merge --auto --squash
   ```
Esto se deja fuera del workflow por defecto para que el equipo pueda
revisar el diff de sincronización antes de fusionarlo, pero queda
documentado por si se quiere automatizar al máximo.

## Solución de problemas

- **`gh pr create` falla con "GitHub Actions is not permitted to create or
  approve pull requests"**: falta activar la casilla del paso 2
  (*Allow GitHub Actions to create and approve pull requests*).
- **El check "Branch Policy" no aparece en la lista de checks obligatorios
  al configurar la protección de rama**: debe ejecutarse al menos una vez
  (paso 3) antes de que GitHub lo ofrezca como opción seleccionable.
- **El PR de sync no se crea a pesar de haber diferencias**: revisa los
  logs del job `sync-pr` en la pestaña Actions; el paso "Verificar si
  develop ya está al día con main" imprime el resultado de la comparación
  (`has_diff=true/false`).
- **Un PR legítimo es bloqueado por Branch Policy**: revisa el mensaje del
  job, que imprime explícitamente la rama origen, la rama destino y (si
  aplica) el autor, e indica por qué combinación no está permitida.
