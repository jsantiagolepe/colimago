//! Lectura del payload de un JWT, *sin* verificar la firma.
//!
//! Solo se usa para decisiones locales (¿ya venció la sesión?, ¿este
//! id_token es para esta app y este intento?). Quien verifica firmas es el
//! backend, que recibe el token completo.

use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde_json::Value;

pub fn payload(token: &str) -> Option<Value> {
    let part = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(part.trim_end_matches('=')).ok()?;
    serde_json::from_slice::<Value>(&bytes).ok().filter(Value::is_object)
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Comparación en tiempo constante para `state` y `nonce`.
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
pub(crate) fn fake_token(claims: &Value) -> String {
    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"none"}"#);
    let body = URL_SAFE_NO_PAD.encode(claims.to_string());
    format!("{header}.{body}.firma")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn lee_el_payload() {
        let token = fake_token(&json!({ "exp": 123, "sub": "abc" }));
        assert_eq!(payload(&token).unwrap()["exp"], 123);
    }

    #[test]
    fn rechaza_tokens_mal_formados() {
        assert!(payload("no-es-un-jwt").is_none());
        assert!(payload("a.###.c").is_none());
        assert!(payload(&format!("a.{}.c", URL_SAFE_NO_PAD.encode("[1,2]"))).is_none());
    }

    #[test]
    fn compara_en_tiempo_constante() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "abcd"));
    }
}
