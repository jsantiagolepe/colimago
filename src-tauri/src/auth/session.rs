//! La sesión: el JWT que entrega el backend y los datos de la cuenta.
//!
//! Se guarda en el Llavero de macOS (nunca en archivos, localStorage ni
//! en el frontend). El JWT es lo único sensible de toda la app: con él el
//! backend acepta peticiones de administrador.

use serde::{Deserialize, Serialize};

use crate::{config, jwt};

/// Lo que el frontend sí puede saber de la sesión.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUser {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    pub user: SessionUser,
}

// A mano para que el token nunca termine en un log.
impl std::fmt::Debug for Session {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Session").field("token", &"<oculto>").field("user", &self.user).finish()
    }
}

impl Session {
    /// Vencida según el `exp` del JWT (con 30 s de margen). Si el token no
    /// trae `exp`, se considera vigente y el backend decide con un 401.
    pub fn is_expired(&self) -> bool {
        is_expired_at(&self.token, jwt::now_secs())
    }
}

fn is_expired_at(token: &str, now: u64) -> bool {
    jwt::payload(token)
        .and_then(|claims| claims["exp"].as_u64())
        .is_some_and(|exp| exp <= now + 30)
}

fn entry() -> keyring::Result<keyring::Entry> {
    keyring::Entry::new(config::KEYCHAIN_SERVICE, config::KEYCHAIN_ACCOUNT)
}

/// Lee la sesión guardada. Cualquier problema (no hay, el Llavero negó el
/// acceso, datos ilegibles) cuenta como "sin sesión": se vuelve al login.
pub fn load() -> Option<Session> {
    let secret = match entry().and_then(|e| e.get_password()) {
        Ok(secret) => secret,
        Err(keyring::Error::NoEntry) => return None,
        Err(err) => {
            log::warn!("no se pudo leer la sesión del Llavero: {err}");
            return None;
        }
    };
    match serde_json::from_str::<Session>(&secret) {
        Ok(session) => Some(session),
        Err(_) => {
            log::warn!("la sesión guardada en el Llavero es ilegible; se descarta");
            clear();
            None
        }
    }
}

pub fn save(session: &Session) -> Result<(), String> {
    let secret = serde_json::to_string(session).map_err(|e| e.to_string())?;
    entry().and_then(|e| e.set_password(&secret)).map_err(|e| e.to_string())
}

pub fn clear() {
    match entry().and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(err) => log::warn!("no se pudo borrar la sesión del Llavero: {err}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn vence_segun_exp_con_margen() {
        let token = jwt::fake_token(&json!({ "exp": 1_000 }));
        assert!(!is_expired_at(&token, 900));
        assert!(is_expired_at(&token, 980)); // dentro del margen de 30 s
        assert!(is_expired_at(&token, 2_000));
    }

    #[test]
    fn sin_exp_no_vence() {
        assert!(!is_expired_at(&jwt::fake_token(&json!({ "sub": "x" })), u64::MAX - 100));
        assert!(!is_expired_at("token-opaco", 0));
    }

    #[test]
    fn debug_no_muestra_el_token() {
        let session = Session {
            token: "secreto".into(),
            user: SessionUser { id: "1".into(), name: "Ana".into(), email: None },
        };
        assert!(!format!("{session:?}").contains("secreto"));
    }
}
