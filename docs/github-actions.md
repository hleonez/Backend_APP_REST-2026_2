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
main       -->  develop   (fast-forward de sync-develop.yml;
                            develop pasa a apuntar al commit de main)
```

Reglas:
- Nadie hace push directo a `main`. A `develop` solo entran PRs desde
  `feature/*`, más el fast-forward del workflow de sincronización.
- Todo el trabajo nuevo se hace en una rama `feature/<nombre>` creada desde
  `develop`.
- `main` solo se actualiza mediante un PR desde `develop`.
- Después de cada merge a `main`, `sync-develop.yml` adelanta `develop`
  hasta ese mismo commit (`git push origin HEAD:develop`) si `develop` es
  ancestro de `main`. No abre un PR y no usa `--force`. Si `develop` tiene
  commits que `main` no tiene, el job falla y el historial no se reescribe.

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
  `head = main` y autor `github-actions[bot]`. El sync ya no abre ese PR;
  la excepción sigue en el check.

Este check debe marcarse como **obligatorio** en la protección de rama (ver
más abajo) para que realmente bloquee el merge.

### 3. [`.github/workflows/sync-develop.yml`](../.github/workflows/sync-develop.yml)
Corre en cada `push` a `main` (es decir, después de aceptar el PR
`develop -> main`) y también con `workflow_dispatch`. Comprueba si
`origin/develop` es ancestro de `HEAD` (el commit recién llegado a `main`):
- Si lo es, hace fast-forward: `git push origin HEAD:develop`. `develop` y
  `main` quedan en el mismo commit. Un merge commit sin cambios de archivos
  también se adelanta; un `git diff` de árboles lo habría saltado.
- Si no lo es, el job falla. `develop` tiene commits que `main` no tiene y
  un push normal no es fast-forward. No se usa `--force`.

Eso no reescribe historia. Un `git push --force` de `main` sobre `develop`
borraría el trabajo que solo está en `develop` y rompería las ramas
`feature/*` creadas desde el `develop` anterior.

El archivo de workflow que corre es el de `main`. Después de mergear este
cambio hasta `main`, un `workflow_dispatch` solo adelanta `develop` si en
ese momento `develop` ya es ancestro de `main`. Si `develop` va por delante
con commits que todavía no se han liberado, el job falla a propósito.

## Guía de activación (paso a paso en GitHub)

### 1. Habilitar GitHub Actions en el repositorio
1. Ve a **Settings -> Actions -> General**.
2. En **Actions permissions**, deja seleccionado *Allow all actions and
   reusable workflows* (o, si tu organización restringe esto, permite al
   menos `actions/checkout` y `actions/setup-node`; el resto del trabajo lo
   hace `gh`, que ya viene preinstalado en los runners de GitHub).
3. Guarda los cambios.

### 2. Dar permiso de escritura al token de Actions
El fast-forward lo hace `git push` con el `GITHUB_TOKEN` del workflow:
1. En la misma página, baja hasta **Workflow permissions**.
2. Selecciona **Read and write permissions**.
3. Guarda los cambios.

El workflow ya declara `permissions: contents: write`. Sin escritura en el
repositorio, el push a `develop` se rechaza.

### 3. Dejar que Actions actualice `develop`
`develop` puede seguir exigiendo Pull Request para las personas. El sync no
abre un PR: empuja el fast-forward. Si la protección dice "Require a pull
request" y no hay bypass, GitHub rechaza el push aunque el token tenga
`contents: write`.
1. En la regla o ruleset de `develop`, agrega un bypass para el actor
   **GitHub Actions** (`github-actions[bot]`), limitado a lo que haga falta
   para actualizar esa rama.
2. No des ese bypass en `main`. `main` sigue aceptando solo PRs desde
   `develop`.

### 4. Ejecutar un primer PR de prueba (para que los checks aparezcan)
Antes de poder marcar los checks como obligatorios en la protección de
rama, GitHub necesita haberlos visto correr al menos una vez:
1. Crea una rama `feature/prueba-ci` desde `develop`.
2. Haz un cambio trivial y súbela.
3. Abre un Pull Request `feature/prueba-ci -> develop`.
4. Confirma en la pestaña **Checks** del PR que corren y pasan:
   - `CI / Instalar dependencias y compilar`
   - `Branch Policy / Validar origen/destino del PR`
5. Puedes cerrar este PR de prueba sin fusionarlo una vez verificado.

### 5. Proteger la rama `main`
1. Ve a **Settings -> Branches -> Branch protection rules -> Add rule**
   (o **Rulesets** si tu repo usa la UI nueva de reglas).
2. **Branch name pattern**: `main`.
3. Activa **Require a pull request before merging**.
   - Aquí sí puedes activar **Require approvals** (por ejemplo, 1) si
     quieres que alguien revise antes de mergear a `main`. El sync no abre
     PRs; solo adelanta `develop`.
4. Activa **Require status checks to pass before merging** y selecciona:
   - `CI / Instalar dependencias y compilar`
   - `Branch Policy / Validar origen/destino del PR`
5. (Recomendado) Activa **Do not allow bypassing the above settings** para
   que ni siquiera administradores puedan hacer push directo.
6. Guarda la regla.

### 6. Proteger la rama `develop`
Repite el paso 5 con **Branch name pattern**: `develop` y los mismos checks
obligatorios para los PRs de `feature/*`.

- Agrega el bypass de **GitHub Actions** descrito en el paso 3. Sin ese
  bypass, el fast-forward de `sync-develop.yml` no puede actualizar
  `develop`.
- Los PRs de personas hacia `develop` siguen pasando por `CI` y
  `Branch Policy`.

`branch-policy.yml` sigue bloqueando PRs que no sean `feature/* -> develop`
o `develop -> main`. El sync ya no usa un PR `main -> develop`.

### 7. Probar el ciclo completo
1. Fusiona un PR `feature/algo -> develop` (debe pasar CI + Branch Policy).
2. Abre y fusiona un PR `develop -> main` (debe pasar CI + Branch Policy).
3. Ve a la pestaña **Actions** y confirma que se disparó
   **Sync develop with main**.
4. Si en ese momento `develop` era ancestro de `main`, `develop` queda en
   el mismo commit que `main`. No aparece un PR de sync.
5. Si `develop` tenía commits que `main` no tiene, el job falla y `develop`
   no se mueve. No hay force-push. Hay que fusionar `develop` a `main`
   primero, en un release, y el siguiente sync sí puede adelantar.

## Solución de problemas

- **El check "Branch Policy" no aparece en la lista de checks obligatorios
  al configurar la protección de rama**: debe ejecutarse al menos una vez
  (paso 4) antes de que GitHub lo ofrezca como opción seleccionable.
- **El push a `develop` se rechaza por protección de rama**: falta el bypass
  de GitHub Actions en `develop` (paso 3). El token tiene `contents: write`,
  pero una regla "Require a pull request" sin bypass bloquea igual el
  fast-forward.
- **El job falla con "develop tiene commits que main no tiene"**: no es un
  fast-forward. El log imprime el SHA de `HEAD` y el de `origin/develop`.
  No se reescribe `develop`. Fusiona primero `develop` en `main`.
- **Un PR legítimo es bloqueado por Branch Policy**: revisa el mensaje del
  job, que imprime explícitamente la rama origen, la rama destino y (si
  aplica) el autor, e indica por qué combinación no está permitida.
