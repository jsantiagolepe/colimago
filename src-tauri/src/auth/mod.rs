//! Autenticación de la app: inicio de sesión con Google, sesión en el
//! Llavero y comandos para el frontend.
//!
//! Flujo: Google (navegador del sistema, ver google.rs) → id_token →
//! backend POST /login/google → JWT del backend → se revisa que la cuenta
//! sea la dueña (config::owner_user_id) → JWT al Llavero. El frontend solo
//! recibe el nombre y el correo; el JWT nunca sale de Rust.

mod google;
mod session;

use std::{
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State, async_runtime::spawn_blocking};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

pub use session::SessionUser;

use crate::{backend::Backend, config, error::AppError};
use session::Session;

/// Se emite cuando el backend rechaza el JWT (401): el frontend regresa al login.
pub const SESSION_EXPIRED_EVENT: &str = "auth:session-expired";

#[derive(Default)]
pub struct AuthState {
    /// `None` mientras no se ha leído el Llavero (se lee una sola vez).
    session: tokio::sync::Mutex<Option<Option<Session>>>,
    sign_in: Mutex<Option<PendingSignIn>>,
    sign_in_ids: AtomicU64,
}

struct PendingSignIn {
    id: u64,
    url: String,
    cancel: oneshot::Sender<()>,
}

impl AuthState {
    async fn current(&self) -> Option<Session> {
        let mut slot = self.session.lock().await;
        if slot.is_none() {
            let loaded = spawn_blocking(session::load).await.unwrap_or_else(|err| {
                log::warn!("no se pudo leer la sesión: {err}");
                None
            });
            *slot = Some(loaded);
        }
        let current = slot.clone().flatten();
        if current.as_ref().is_some_and(Session::is_expired) {
            log::info!("la sesión guardada ya venció");
            *slot = Some(None);
            let _ = spawn_blocking(session::clear).await;
            return None;
        }
        current
    }

    /// JWT de la sesión actual, para el backend.
    pub async fn token(&self) -> Option<String> {
        self.current().await.map(|session| session.token)
    }

    async fn replace(&self, session: Option<Session>) {
        *self.session.lock().await = Some(session);
    }

    /// El backend ya no acepta el token: se olvida y se avisa al frontend.
    pub async fn expire(&self, app: &AppHandle, message: Option<String>) {
        let had_session = {
            let mut slot = self.session.lock().await;
            let had = matches!(&*slot, Some(Some(_)));
            *slot = Some(None);
            had
        };
        let _ = spawn_blocking(session::clear).await;
        if had_session {
            log::info!("el backend rechazó la sesión; se cerró");
            let _ = app.emit(SESSION_EXPIRED_EVENT, json!({ "message": message }));
        }
    }

    fn begin_sign_in(&self, url: String) -> (u64, oneshot::Receiver<()>) {
        let (cancel, cancelled) = oneshot::channel();
        let id = self.sign_in_ids.fetch_add(1, Ordering::SeqCst);
        let previous = self.sign_in.lock().unwrap().replace(PendingSignIn { id, url, cancel });
        if let Some(previous) = previous {
            let _ = previous.cancel.send(());
        }
        (id, cancelled)
    }

    fn end_sign_in(&self, id: u64) {
        let mut pending = self.sign_in.lock().unwrap();
        if pending.as_ref().is_some_and(|p| p.id == id) {
            pending.take();
        }
    }

    fn cancel_sign_in(&self) {
        if let Some(pending) = self.sign_in.lock().unwrap().take() {
            let _ = pending.cancel.send(());
        }
    }
}

/// Sesión actual, o `null` si hay que iniciar sesión.
#[tauri::command]
pub async fn auth_get_session(auth: State<'_, AuthState>) -> Result<Option<SessionUser>, AppError> {
    let user = auth.current().await.map(|session| session.user);
    match &user {
        Some(user) => log::info!("sesión guardada: {}", user.name),
        None => log::info!("sin sesión guardada: se muestra el login"),
    }
    Ok(user)
}

/// Abre Google en el navegador y espera a que termines de iniciar sesión.
#[tauri::command]
pub async fn auth_sign_in_google(
    app: AppHandle,
    auth: State<'_, AuthState>,
    backend: State<'_, Backend>,
) -> Result<SessionUser, AppError> {
    // Si había otro intento abierto se cancela primero, para liberar su puerto.
    auth.cancel_sign_in();
    let mut flow = google::BrowserSignIn::start()?;
    let (id, cancelled) = auth.begin_sign_in(flow.url().to_owned());
    let result = sign_in(&app, &auth, &backend, &mut flow, cancelled).await;
    auth.end_sign_in(id);
    match &result {
        Ok(user) => log::info!("sesión iniciada como {}", user.name),
        Err(err) => log::info!("inicio de sesión no completado: {err}"),
    }
    result
}

async fn sign_in(
    app: &AppHandle,
    auth: &AuthState,
    backend: &Backend,
    flow: &mut google::BrowserSignIn,
    cancelled: oneshot::Receiver<()>,
) -> Result<SessionUser, AppError> {
    app.opener()
        .open_url(flow.url(), None::<&str>)
        .map_err(|err| AppError::SignIn(format!("No se pudo abrir el navegador: {err}")))?;

    let credential = tokio::select! {
        credential = flow.credential() => credential?,
        _ = cancelled => return Err(AppError::Cancelled),
        _ = tokio::time::sleep(Duration::from_secs(config::SIGN_IN_TIMEOUT_SECS)) => {
            return Err(AppError::SignIn("Se agotó el tiempo para iniciar sesión. Inténtalo de nuevo.".into()));
        }
    };

    if let Err(err) = flow.check_id_token(&credential.id_token) {
        credential.reply_error(&err.to_string());
        return Err(err);
    }
    let login = match backend.login_google(&credential.id_token).await {
        Ok(login) => login,
        Err(err) => {
            credential.reply_error(&err.to_string());
            return Err(err);
        }
    };
    if login.user.id != config::owner_user_id() {
        let err = AppError::SignIn("Esta cuenta de Google no tiene permiso para entrar a MyProject.".into());
        credential.reply_error(&err.to_string());
        return Err(err);
    }

    let session = Session { token: login.token, user: login.user };
    let to_save = session.clone();
    match spawn_blocking(move || session::save(&to_save)).await {
        Ok(Ok(())) => {}
        Ok(Err(err)) => log::warn!("no se pudo guardar la sesión en el Llavero ({err}); durará mientras la app esté abierta"),
        Err(err) => log::warn!("no se pudo guardar la sesión en el Llavero ({err})"),
    }
    let user = session.user.clone();
    auth.replace(Some(session)).await;
    credential.reply_ok(&user.name);
    focus_main_window(app);
    Ok(user)
}

/// Cancela el inicio de sesión en curso (botón "Cancelar").
#[tauri::command]
pub fn auth_cancel_sign_in(auth: State<'_, AuthState>) {
    auth.cancel_sign_in();
}

/// Vuelve a abrir la página de Google por si cerraste la pestaña.
#[tauri::command]
pub fn auth_reopen_sign_in(app: AppHandle, auth: State<'_, AuthState>) -> Result<(), AppError> {
    let url = auth.sign_in.lock().unwrap().as_ref().map(|pending| pending.url.clone());
    let url = url.ok_or_else(|| AppError::InvalidRequest("No hay un inicio de sesión en curso.".into()))?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|err| AppError::SignIn(format!("No se pudo abrir el navegador: {err}")))
}

#[tauri::command]
pub async fn auth_sign_out(auth: State<'_, AuthState>) -> Result<(), AppError> {
    auth.cancel_sign_in();
    auth.replace(None).await;
    let _ = spawn_blocking(session::clear).await;
    log::info!("sesión cerrada");
    Ok(())
}

pub fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
