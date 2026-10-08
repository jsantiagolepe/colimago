//! Guardar un archivo de texto donde elijas, con el diálogo nativo de
//! macOS. Así el webview no necesita ningún permiso sobre el disco: solo
//! se escribe en la ruta que tú escogiste en el diálogo.

use tauri::{AppHandle, WebviewWindow, async_runtime::spawn_blocking};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

use crate::error::AppError;

const MAX_BYTES: usize = 50 * 1024 * 1024;

/// Regresa `false` si cancelaste el diálogo.
#[tauri::command]
pub async fn save_text_file(
    app: AppHandle,
    window: WebviewWindow,
    suggested_name: String,
    contents: String,
) -> Result<bool, AppError> {
    if contents.len() > MAX_BYTES {
        return Err(AppError::InvalidRequest("El archivo es demasiado grande.".into()));
    }
    let name = sanitize_file_name(&suggested_name);

    let (tx, rx) = oneshot::channel();
    let mut dialog = app.dialog().file().set_parent(&window).set_file_name(&name);
    if let Some((_, ext)) = name.rsplit_once('.') {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext]);
    }
    dialog.save_file(move |path| {
        let _ = tx.send(path);
    });

    let Some(path) = rx.await.ok().flatten() else {
        return Ok(false);
    };
    let path = path
        .into_path()
        .map_err(|_| AppError::InvalidRequest("Ruta de archivo inválida.".into()))?;
    let destino = path.display().to_string();
    spawn_blocking(move || std::fs::write(&path, contents))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map_err(|e| AppError::Internal(format!("No se pudo guardar el archivo: {e}")))?;
    log::info!("archivo guardado en {destino}");
    Ok(true)
}

fn sanitize_file_name(name: &str) -> String {
    let limpio: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '\0') && !c.is_control())
        .collect();
    let limpio = limpio.trim().trim_start_matches('.');
    if limpio.is_empty() { "archivo.txt".into() } else { limpio.chars().take(120).collect() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nombres_seguros() {
        assert_eq!(sanitize_file_name("catalog.json"), "catalog.json");
        assert_eq!(sanitize_file_name("../../etc/passwd"), "etcpasswd");
        assert_eq!(sanitize_file_name(".."), "archivo.txt");
        assert_eq!(sanitize_file_name(""), "archivo.txt");
    }
}
