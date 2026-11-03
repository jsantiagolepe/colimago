//! MyProject: núcleo nativo de la app.
//!
//! El frontend (React) no tiene acceso a la red ni al disco por sí mismo:
//! todo lo que necesita permisos pasa por los comandos de aquí, y cada
//! comando está declarado en build.rs y concedido en capabilities/.

mod auth;
mod backend;
mod config;
mod error;
mod files;
mod jwt;
mod maps;
mod storage;

use tauri::{Manager, Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_opener::OpenerExt;

/// La ventana solo muestra la app. Cualquier intento de navegar a otro
/// sitio (un enlace sin target, arrastrar una URL…) se abre en el
/// navegador del sistema en lugar de cargarse dentro de la app.
fn navigation_guard<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|webview, url| {
            let internal = url.scheme() == "tauri"
                || url.host_str() == Some("tauri.localhost")
                || (cfg!(debug_assertions) && url.host_str() == Some("localhost") && url.port() == Some(1420));
            if !internal && matches!(url.scheme(), "http" | "https") {
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
            }
            internal
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Primero: si ya hay una ventana abierta, se enfoca en vez de abrir
        // otra instancia (dos instancias pelearían por el puerto del login).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            auth::focus_main_window(app);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("tiny_http", log::LevelFilter::Warn)
                .targets([
                    Target::new(TargetKind::Stdout),
                    // ~/Library/Logs/com.juliosantiago.myproject/MyProject.log
                    Target::new(TargetKind::LogDir { file_name: Some("MyProject".into()) }),
                ])
                .max_file_size(2 * 1024 * 1024)
                .rotation_strategy(RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(navigation_guard())
        .manage(auth::AuthState::default())
        .setup(|app| {
            app.manage(backend::Backend::new(config::backend_url())?);
            log::info!(
                "MyProject {} iniciada; backend: {}",
                app.package_info().version,
                config::backend_url()
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_get_session,
            auth::auth_sign_in_google,
            auth::auth_cancel_sign_in,
            auth::auth_reopen_sign_in,
            auth::auth_sign_out,
            backend::backend_request,
            backend::backend_upload_image,
            maps::resolve_maps_link,
            files::save_text_file,
            storage::data_read,
            storage::data_write,
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar MyProject");
}
