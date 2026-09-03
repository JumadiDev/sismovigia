# Skill: git-analyzer

Análisis completo del repositorio Git del proyecto sismovigia.

## Uso

Invocar cuando el usuario pida:
- Analizar el repositorio
- Ver estado del proyecto
- Revisar ramas y commits
- Diagnosticar el estado de Git

## Comandos de análisis

Ejecutar todos estos comandos en paralelo:

```bash
# 1. Estado actual
git status

# 2. Últimos 15 commits
git log --oneline -15

# 3. Todas las ramas (locales y remotas)
git branch -a

# 4. Información del remoto
git remote -v

# 5. Cambios pendientes (stat)
git diff --stat

# 6. Últimos commits de main
git log --oneline main -5

# 7. Diff detallado de archivos modificados
git diff
```

## Convención de commits del proyecto

- **Formato**: `FTD-N-descripcion` en español, kebab-case, sin tildes
- **N es consecutivo POR RAMA**: Cada rama lleva su propia secuencia FTD-1, FTD-2...
- **Rama principal**: `main`
- **Ejemplos**:
  - `FTD-32-public_firebase-messaging-sw`
  - `FTD-31-libreria_use-notification`

## Cálcular siguiente número FTD

```bash
MAX=$(git log --format=%s -500 HEAD | grep -oE '^FTD-[0-9]+' | sort -t- -k2 -n | tail -1)
if [ -z "$MAX" ]; then echo 1; else echo "$((${MAX#FTD-} + 1))"; fi
```

## Formato de salida del análisis

### 1. Tabla resumen

| Aspecto | Valor |
|---------|-------|
| **Rama actual** | `<rama>` |
| **Último commit** | `<hash> <mensaje>` |
| **Ramas locales** | `<cantidad>` |
| **Remoto** | `<url>` |

### 2. Ramas del proyecto

Listar ramas indicando cuáles están fusionadas con main y cuáles pendientes.

### 3. Cambios pendientes

- Archivos modificados (con diff resumido)
- Archivos sin trackear

### 4. Estado de main

- Últimos commits
- Si hay ramas sin fusionar

### 5. Recomendaciones

- Si hay cambios sin commitear → sugerir commit
- Si hay ramas sin fusionar → sugerir merge
- Si main está desactualizado → sugerir pull
