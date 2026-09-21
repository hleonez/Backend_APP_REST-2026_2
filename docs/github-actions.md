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
main       -->  develop   (EXCEPCIÓN: PR automático creado por
                            sync-develop.yml, autor github-actions[bot],
                            que se autofusiona -auto-merge- solo)
```

Reglas:
- Nadie hace push directo a `main` ni a `develop`; todo pasa por Pull
  Request, incluida la sincronización `main -> develop`.
- Todo el trabajo nuevo se hace en una rama `feature/<nombre>` creada desde
  `develop`.
- `main` solo se actualiza mediante un PR desde `develop`.
- `develop` solo se actualiza mediante PRs desde `feature/*`, o mediante el
  PR automático `main -> develop` que abre el workflow de sincronización
  después de cada merge a `main`. Ese PR de sync se fusiona solo (auto-merge)
  en cuanto pasan los checks obligatorios, sin que nadie tenga que hacer
  clic, y siempre con un **merge commit real** (nunca squash/rebase), para
  que `main` quede como ancestro directo de `develop` y el historial no se
  reescriba.

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
- En cualquiera de los dos casos anteriores, activa **auto-merge** en ese
  PR con `gh pr merge --auto --merge` (merge commit real, nunca squash). En
  cuanto los checks obligatorios (`CI`, `Branch Policy`) pasan, GitHub lo
  fusiona solo, sin intervención manual.

Este mecanismo **no reescribe historia**: es un merge normal, no un reset
ni un force-push. Esto es intencional y no es solo preferencia — si en vez
de esto se hiciera un `git push --force` de `main` sobre `develop`,
cualquier colaborador que ya tenga una rama `feature/*` en curso (creada
desde el `develop` anterior) o un `develop` local desactualizado se
encontraría con diffs falsos, conflictos sin sentido, o un `git pull` que
falla por "diverged history". Con el enfoque de PR + auto-merge esto nunca
pasa: el historial de `develop` sigue creciendo de forma lineal y compatible
con cualquier rama que ya exista.

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

### 3. Activar auto-merge en el repositorio
Requisito para que `gh pr merge --auto` funcione en `sync-develop.yml`:
1. Ve a **Settings -> General**.
2. Baja hasta la sección **Pull Requests**.
3. Marca la casilla **Allow auto-merge**.
4. (Opcional, no obligatorio) Marca también **Automatically delete head
   branches** para mantener limpio el repo tras cada merge.
5. Guarda los cambios.

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
     quieres que alguien revise antes de mergear a `main`. El bot nunca
     abre PRs hacia `main` (solo hacia `develop`), así que esto no
     interfiere con la automatización.
4. Activa **Require status checks to pass before merging** y selecciona:
   - `CI / Instalar dependencias y compilar`
   - `Branch Policy / Validar origen/destino del PR`
5. (Recomendado) Activa **Do not allow bypassing the above settings** para
   que ni siquiera administradores puedan hacer push directo.
6. Guarda la regla.

### 6. Proteger la rama `develop`
Repite el paso 5 con **Branch name pattern**: `develop`, con los mismos
checks obligatorios, pero con una diferencia importante:

- **NO actives "Require approvals" en `develop`** (o déjalo en 0). El PR de
  sincronización `main -> develop` lo abre `github-actions[bot]` y necesita
  auto-fusionarse (auto-merge) sin que un humano lo apruebe a mano. Si
  exiges aprobación aquí, el auto-merge se queda esperando esa aprobación
  indefinidamente y la sincronización automática deja de funcionar.
- El resto de PRs hacia `develop` (los de `feature/*`) sí pasan igual por
  `CI` y `Branch Policy` como checks obligatorios; simplemente no exigen
  una aprobación humana adicional a nivel de rama.

Con esto, ni `main` ni `develop` aceptan push directo: todo pasa por PR, y
`branch-policy.yml` bloquea cualquier PR que no siga la convención
(`feature/*  -> develop`, `develop -> main`, o el PR automático
`main -> develop`).

### 7. Probar el ciclo completo
1. Fusiona un PR `feature/algo -> develop` (debe pasar CI + Branch Policy).
2. Abre y fusiona un PR `develop -> main` (debe pasar CI + Branch Policy).
3. Ve a la pestaña **Actions** y confirma que se disparó el workflow
   **Sync main -> develop**.
4. Si había diferencias, debe existir un nuevo Pull Request `main -> develop`,
   creado por `github-actions[bot]`, con auto-merge activado.
5. En cuanto sus checks (`CI`, `Branch Policy`) pasen, ese PR se fusiona
   solo — no hace falta revisarlo ni hacer clic en nada. `develop` queda
   igual a `main` mediante un merge commit normal (no se reescribe
   historia).

## Solución de problemas

- **`gh pr create` falla con "GitHub Actions is not permitted to create or
  approve pull requests"**: falta activar la casilla del paso 2
  (*Allow GitHub Actions to create and approve pull requests*).
- **El check "Branch Policy" no aparece en la lista de checks obligatorios
  al configurar la protección de rama**: debe ejecutarse al menos una vez
  (paso 4) antes de que GitHub lo ofrezca como opción seleccionable.
- **El PR de sync no se crea a pesar de haber diferencias**: revisa los
  logs del job `sync-pr` en la pestaña Actions; el paso "Verificar si
  develop ya está al día con main" imprime el resultado de la comparación
  (`has_diff=true/false`).
- **Un PR legítimo es bloqueado por Branch Policy**: revisa el mensaje del
  job, que imprime explícitamente la rama origen, la rama destino y (si
  aplica) el autor, e indica por qué combinación no está permitida.
- **`gh pr merge --auto` falla con un error sobre auto-merge no permitido**:
  falta activar la casilla **Allow auto-merge** del paso 3 (Settings ->
  General -> Pull Requests). El workflow se puede volver a disparar con
  `workflow_dispatch` una vez activada, sin esperar otro push a `main`.
- **El PR de sincronización se queda abierto sin fusionarse aunque los
  checks pasaron**: revisa si `develop` tiene "Require approvals" activado
  en su protección de rama (paso 6). Si es así, quítalo o el auto-merge se
  queda esperando una aprobación humana que nunca llega para el PR del bot.
