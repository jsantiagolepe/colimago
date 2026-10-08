//! Resuelve un link corto de Google Maps (maps.app.goo.gl/..., el que da
//! "Compartir") al URL largo, que es el que trae nombre y coordenadas. El
//! webview no puede seguir ese redirect por CORS, así que lo hace Rust
//! (antes era GET /api/resolver-maps de server.js). Solo se aceptan hosts
//! de Google en cada salto para que esto no sirva como proxy abierto.

use std::time::Duration;

use reqwest::header::LOCATION;
use tauri::State;
use url::Url;

use crate::{auth::AuthState, error::AppError};

const SHORT_HOSTS: [&str; 2] = ["maps.app.goo.gl", "goo.gl"];

#[tauri::command]
pub async fn resolve_maps_link(auth: State<'_, AuthState>, url: String) -> Result<String, AppError> {
    if auth.token().await.is_none() {
        return Err(AppError::NotAuthenticated("No has iniciado sesión.".into()));
    }
    resolve(&url).await
}

async fn resolve(link: &str) -> Result<String, AppError> {
    let mut current = Url::parse(link.trim()).map_err(|_| AppError::InvalidRequest("El link no es válido.".into()))?;
    if !matches!(current.scheme(), "https" | "http") || !SHORT_HOSTS.contains(&current.host_str().unwrap_or_default()) {
        return Err(AppError::InvalidRequest("Solo se aceptan links cortos de Google Maps.".into()));
    }

    let unreachable = || AppError::Network("No se pudo abrir el link corto. Pega el link largo del navegador.".into());
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| unreachable())?;

    // Se siguen los redirects a mano (máx. 5) para validar cada salto.
    for _ in 0..5 {
        let response = client.get(current.clone()).send().await.map_err(|_| unreachable())?;
        let Some(location) = response.headers().get(LOCATION).and_then(|v| v.to_str().ok()) else {
            break;
        };
        let next = current.join(location).map_err(|_| unreachable())?;
        let host = next.host_str().unwrap_or_default();
        if !is_google_host(host) && !SHORT_HOSTS.contains(&host) {
            return Err(AppError::InvalidRequest("El link no lleva a Google Maps.".into()));
        }
        current = next;
    }
    Ok(current.to_string())
}

/// google.com, www.google.com.mx, maps.google.co.uk… (una o dos etiquetas
/// de dominio después de "google").
fn is_google_host(host: &str) -> bool {
    let labels: Vec<&str> = host.split('.').collect();
    labels.iter().position(|&label| label == "google").is_some_and(|i| {
        let tld = &labels[i + 1..];
        (1..=2).contains(&tld.len()) && tld.iter().all(|l| !l.is_empty() && l.chars().all(|c| c.is_ascii_lowercase()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconoce_hosts_de_google() {
        for ok in ["google.com", "www.google.com", "www.google.com.mx", "maps.google.co.uk"] {
            assert!(is_google_host(ok), "{ok}");
        }
        for malo in ["evilgoogle.com", "google.com.evil.net", "google", "notgoogle.com", "goo.gl.evil.com"] {
            assert!(!is_google_host(malo), "{malo}");
        }
    }

    #[tokio::test]
    async fn rechaza_links_que_no_son_cortos_de_maps() {
        assert!(resolve("https://evil.com/x").await.is_err());
        assert!(resolve("file:///etc/passwd").await.is_err());
        assert!(resolve("no es un link").await.is_err());
    }
}
