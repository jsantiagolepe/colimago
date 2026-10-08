//! Datos propios de los módulos (calendario, finanzas…), guardados como
//! JSON en ~/Library/Application Support/com.juliosantiago.myproject/data/.
//! El webview no toca el disco: solo lee y escribe documentos por su
//! nombre ("calendar"), nunca por ruta.

use std::{
    io::ErrorKind,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::{AppHandle, Manager, async_runtime::spawn_blocking};

use crate::error::AppError;

const MAX_BYTES: usize = 10 * 1024 * 1024;

/// Una escritura a la vez: así dos guardados seguidos no se pisan el
/// archivo temporal.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Regresa `None` si el documento todavía no existe.
#[tauri::command]
pub async fn data_read(app: AppHandle, name: String) -> Result<Option<String>, AppError> {
    let path = document_path(&app, &name)?;
    spawn_blocking(move || read(&path))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn data_write(app: AppHandle, name: String, contents: String) -> Result<(), AppError> {
    if contents.len() > MAX_BYTES {
        return Err(AppError::InvalidRequest("Los datos son demasiado grandes.".into()));
    }
    let path = document_path(&app, &name)?;
    spawn_blocking(move || write_atomic(&path, &contents))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
}

fn document_path(app: &AppHandle, name: &str) -> Result<PathBuf, AppError> {
    if !is_valid_name(name) {
        return Err(AppError::InvalidRequest("Nombre de documento inválido.".into()));
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("No se encontró la carpeta de datos: {e}")))?;
    Ok(dir.join("data").join(format!("{name}.json")))
}

/// Solo minúsculas, dígitos y guiones: nunca puede salir de data/.
fn is_valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn read(path: &Path) -> Result<Option<String>, AppError> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::Internal(format!("No se pudieron leer tus datos: {e}"))),
    }
}

/// Escribe a un archivo temporal y lo renombra: si la app se cierra a la
/// mitad queda la versión anterior completa, nunca un archivo cortado.
fn write_atomic(path: &Path, contents: &str) -> Result<(), AppError> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let error = |e: std::io::Error| AppError::Internal(format!("No se pudieron guardar tus datos: {e}"));
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(error)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, contents).map_err(error)?;
    std::fs::rename(&tmp, path).map_err(error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nombres_validos() {
        assert!(is_valid_name("calendar"));
        assert!(is_valid_name("finances-2026"));
        assert!(!is_valid_name(""));
        assert!(!is_valid_name("../calendar"));
        assert!(!is_valid_name("data/calendar"));
        assert!(!is_valid_name("Calendar"));
        assert!(!is_valid_name("calendar.json"));
        assert!(!is_valid_name(&"a".repeat(65)));
    }

    #[test]
    fn escribe_y_lee() {
        let dir = std::env::temp_dir().join(format!("myproject-storage-{}", std::process::id()));
        let path = dir.join("data").join("calendar.json");
        assert_eq!(read(&path).unwrap(), None);
        write_atomic(&path, r#"{"version":1}"#).unwrap();
        write_atomic(&path, r#"{"version":2}"#).unwrap();
        assert_eq!(read(&path).unwrap().as_deref(), Some(r#"{"version":2}"#));
        assert!(!path.with_extension("json.tmp").exists());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
