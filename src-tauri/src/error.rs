//! Error común de los comandos. Llega al frontend como
//! `{ kind, message }`, con el mensaje ya listo para mostrarse.

use serde::{Serialize, Serializer, ser::SerializeStruct};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// No hay sesión (o ya no es válida): el frontend regresa al login.
    #[error("{0}")]
    NotAuthenticated(String),
    /// El inicio de sesión falló (Google, backend o cuenta no autorizada).
    #[error("{0}")]
    SignIn(String),
    /// El usuario canceló el inicio de sesión.
    #[error("Inicio de sesión cancelado.")]
    Cancelled,
    /// No se pudo hablar con el backend (red, DNS, timeout).
    #[error("{0}")]
    Network(String),
    /// La petición del frontend no es válida (ruta, método, URL…).
    #[error("{0}")]
    InvalidRequest(String),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            AppError::NotAuthenticated(_) => "notAuthenticated",
            AppError::SignIn(_) => "signIn",
            AppError::Cancelled => "cancelled",
            AppError::Network(_) => "network",
            AppError::InvalidRequest(_) => "invalidRequest",
            AppError::Internal(_) => "internal",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("kind", self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        log::warn!("error de red hacia el backend: {err}");
        if err.is_timeout() {
            AppError::Network("El backend tardó demasiado en responder. Inténtalo de nuevo.".into())
        } else {
            AppError::Network("No se pudo conectar con el backend. Revisa tu conexión a internet.".into())
        }
    }
}
