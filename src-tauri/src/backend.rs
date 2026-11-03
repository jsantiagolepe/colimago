//! Puerta única hacia el backend remoto (NestJS en Heroku). Reemplaza al
//! proxy de server.js y a lib/colima-backend.js de la versión web.
//!
//! El frontend nunca ve el JWT: pide `backend_request` con método, ruta,
//! query y body, y aquí se agrega `Authorization: Bearer <jwt>` (la única
//! forma en que el backend acepta el token). Solo se habla con la URL de
//! config.rs y la ruta se valida para que no pueda salirse de ella.
//!
//! La respuesta regresa tal cual (status + JSON) y el frontend decide cómo
//! mostrar cada error (src/core/backend/client.ts conserva la lógica de
//! lib/colima-backend.js). Un 401 con sesión la cierra aquí mismo: ese
//! token ya no sirve y no tiene caso guardarlo.

use std::{
    collections::BTreeMap,
    time::{Duration, Instant},
};

use reqwest::{
    Client, Method,
    header::ACCEPT,
    multipart::{Form, Part},
};
use serde::Serialize;
use serde_json::{Value, json};
use tauri::{
    AppHandle, State,
    ipc::{InvokeBody, Request},
};
use url::Url;

use crate::{
    auth::{AuthState, SessionUser},
    error::AppError,
};

pub struct Backend {
    http: Client,
    base: Url,
}

#[derive(Debug, Serialize)]
pub struct BackendResponse {
    pub status: u16,
    /// El JSON que respondió el backend; `{}` si no respondió JSON (Heroku
    /// a veces contesta HTML en un 503 o un timeout).
    pub body: Value,
}

pub struct Login {
    pub token: String,
    pub user: SessionUser,
}

impl Backend {
    pub fn new(base_url: &str) -> Result<Self, AppError> {
        let base = Url::parse(base_url.trim_end_matches('/'))
            .map_err(|_| AppError::Internal(format!("URL de backend inválida: {base_url}")))?;
        let local = matches!(base.host_str(), Some("localhost" | "127.0.0.1"));
        if base.scheme() != "https" && !local {
            return Err(AppError::Internal("El backend debe usar HTTPS.".into()));
        }
        let http = Client::builder()
            .user_agent(concat!("MyProject/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(20))
            // "Aprobar" sube cada imagen a Cloudinary antes de responder, y
            // Heroku puede tardar en despertar: margen amplio.
            .timeout(Duration::from_secs(120))
            // Nunca seguir redirects con el token puesto.
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(Self { http, base })
    }

    fn url(&self, path: &str, query: &BTreeMap<String, String>) -> Result<Url, AppError> {
        validate_path(path)?;
        let mut url = self.base.clone();
        url.set_path(&format!("{}{}", self.base.path().trim_end_matches('/'), path));
        url.set_query(None);
        if !query.is_empty() {
            url.query_pairs_mut().extend_pairs(query);
        }
        Ok(url)
    }

    /// Hace la petición. `token` es None solo para el login.
    pub async fn send(
        &self,
        token: Option<&str>,
        method: &str,
        path: &str,
        query: &BTreeMap<String, String>,
        body: Option<&Value>,
    ) -> Result<BackendResponse, AppError> {
        let method = parse_method(method)?;
        let url = self.url(path, query)?;
        let mut request = self.http.request(method.clone(), url).header(ACCEPT, "application/json");
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if method != Method::GET {
            // Igual que antes: JSON.stringify(body || {})
            request = request.json(body.unwrap_or(&json!({})));
        }

        let started = Instant::now();
        let response = request.send().await?;
        read_response(&format!("{method} {path}"), started, response).await
    }

    /// Sube una imagen a Cloudinary a través del backend (multipart con
    /// `image` y `folder`). `path` es uno de `UPLOAD_ENDPOINTS`. El archivo va
    /// con nombre y tipo genéricos: el backend decide el formato por los
    /// bytes, no por lo que declare el cliente.
    pub async fn upload_image(
        &self,
        token: &str,
        path: &str,
        folder: &str,
        bytes: Vec<u8>,
    ) -> Result<BackendResponse, AppError> {
        let url = self.url(path, &BTreeMap::new())?;
        let part = Part::bytes(bytes)
            .file_name("image")
            .mime_str("application/octet-stream")
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let form = Form::new().text("folder", folder.to_owned()).part("image", part);

        let started = Instant::now();
        let response = self
            .http
            .post(url)
            .header(ACCEPT, "application/json")
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await?;
        read_response(&format!("POST {path}"), started, response).await
    }

    /// POST /login/google con el id_token de Google (mismo cuerpo que
    /// mandaba server.js). Regresa el JWT del backend y la cuenta.
    pub async fn login_google(&self, id_token: &str) -> Result<Login, AppError> {
        let body = json!({ "token": id_token, "platform": "web" });
        let response = self.send(None, "POST", "/login/google", &BTreeMap::new(), Some(&body)).await?;

        let rejected = !(200..300).contains(&response.status) || response.body.get("response") == Some(&Value::Bool(false));
        if rejected {
            log::warn!("el backend rechazó el inicio de sesión ({})", response.status);
            let message = if response.status >= 500 {
                format!("El backend respondió {}. Inténtalo de nuevo en un momento.", response.status)
            } else {
                message_text(&response.body).unwrap_or_else(|| "No se pudo iniciar sesión.".into())
            };
            return Err(AppError::SignIn(message));
        }

        let token = response.body["token"]
            .as_str()
            .filter(|t| !t.is_empty())
            .ok_or_else(|| AppError::SignIn("El backend no devolvió una sesión.".into()))?
            .to_owned();
        let user = &response.body["user"];
        let id = match &user["_id"] {
            Value::String(id) => id.clone(),
            Value::Object(o) => o.get("$oid").and_then(Value::as_str).unwrap_or_default().to_owned(),
            _ => String::new(),
        };
        let email = user["email"].as_str().filter(|e| !e.is_empty()).map(str::to_owned);
        let name = user["name"]
            .as_str()
            .filter(|n| !n.trim().is_empty())
            .map(str::to_owned)
            .or_else(|| email.clone())
            .unwrap_or_else(|| "Administrador".into());
        Ok(Login { token, user: SessionUser { id, name, email } })
    }
}

/// Status + JSON de la respuesta (o `{}` si no vino JSON: Heroku a veces
/// contesta HTML en un 503 o un timeout).
async fn read_response(label: &str, started: Instant, response: reqwest::Response) -> Result<BackendResponse, AppError> {
    let status = response.status().as_u16();
    let text = response.text().await?;
    log::info!("backend {label} → {status} ({} ms)", started.elapsed().as_millis());

    let body = serde_json::from_str::<Value>(&text)
        .ok()
        .filter(|v| v.is_object() || v.is_array())
        .unwrap_or_else(|| json!({}));
    Ok(BackendResponse { status, body })
}

/// NestJS a veces manda "message" como arreglo (errores de validación).
fn message_text(body: &Value) -> Option<String> {
    match &body["message"] {
        Value::String(s) if !s.trim().is_empty() => Some(s.clone()),
        Value::Array(items) => {
            let parts: Vec<&str> = items.iter().filter_map(Value::as_str).filter(|s| !s.is_empty()).collect();
            (!parts.is_empty()).then(|| parts.join(". "))
        }
        _ => None,
    }
}

fn parse_method(method: &str) -> Result<Method, AppError> {
    match method.to_ascii_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        _ => Err(AppError::InvalidRequest(format!("Método no permitido: {method}"))),
    }
}

/// Solo rutas relativas al backend: "/post/local", "/eventos-pendientes"...
fn validate_path(path: &str) -> Result<(), AppError> {
    let valid = path.starts_with('/')
        && path.len() <= 256
        && !path.contains("..")
        && !path.contains("//")
        && path.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_' | '.'));
    if valid { Ok(()) } else { Err(AppError::InvalidRequest(format!("Ruta de backend inválida: {path}"))) }
}

/// Lo máximo que acepta el backend por imagen (MAX_IMAGE_SIZE_BYTES en
/// images.controller.ts): más grande, lo rechazaría después de subirla.
const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;

/// A dónde se pueden subir imágenes. Cada app usa su propia cuenta de
/// Cloudinary, y el backend guarda las credenciales de las dos (la app
/// nunca las ve):
///   - `/images`: la cuenta principal (ColimaApp).
///   - `/magentagroup/images`: la cuenta de Magenta Group (solo admin).
/// Todo lo de Magenta (fotos del catálogo, CRM) va por la segunda.
const UPLOAD_ENDPOINTS: [&str; 2] = ["/images", "/magentagroup/images"];

/// Misma regla que CreateImageDto.folder: segmentos de letras, números, _ y -
/// separados por "/" (sin "..", "&" ni espacios).
fn validate_folder(folder: &str) -> Result<(), AppError> {
    let valid = !folder.is_empty()
        && folder.len() <= 64
        && folder
            .split('/')
            .all(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-')));
    if valid { Ok(()) } else { Err(AppError::InvalidRequest(format!("Carpeta de imágenes inválida: {folder}"))) }
}

/// Sube una imagen a Cloudinary vía el backend. Los bytes llegan crudos por
/// el IPC (no como JSON de números); el destino (`x-endpoint`, uno de
/// `UPLOAD_ENDPOINTS`) y la carpeta (`x-folder`) van en cabeceras. La
/// respuesta regresa igual que en `backend_request` (el frontend lee
/// `body.url`).
#[tauri::command]
pub async fn backend_upload_image(
    app: AppHandle,
    auth: State<'_, AuthState>,
    backend: State<'_, Backend>,
    request: Request<'_>,
) -> Result<BackendResponse, AppError> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::InvalidRequest("La imagen debe enviarse como bytes.".into()));
    };
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok());
    let endpoint = header("x-endpoint")
        .filter(|e| UPLOAD_ENDPOINTS.contains(e))
        .ok_or_else(|| AppError::InvalidRequest("Destino de subida no permitido.".into()))?;
    let folder = header("x-folder").ok_or_else(|| AppError::InvalidRequest("Falta la carpeta de la imagen.".into()))?;
    validate_folder(folder)?;
    if bytes.is_empty() {
        return Err(AppError::InvalidRequest("La imagen está vacía.".into()));
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::InvalidRequest("La imagen pesa más de 8 MB.".into()));
    }

    let token = auth
        .token()
        .await
        .ok_or_else(|| AppError::NotAuthenticated("No has iniciado sesión.".into()))?;
    let response = backend.upload_image(&token, endpoint, folder, bytes.clone()).await?;
    if response.status == 401 {
        auth.expire(&app, message_text(&response.body)).await;
    }
    Ok(response)
}

/// Única forma en que el frontend habla con el backend.
#[tauri::command]
pub async fn backend_request(
    app: AppHandle,
    auth: State<'_, AuthState>,
    backend: State<'_, Backend>,
    method: String,
    path: String,
    query: Option<BTreeMap<String, String>>,
    body: Option<Value>,
) -> Result<BackendResponse, AppError> {
    let token = auth
        .token()
        .await
        .ok_or_else(|| AppError::NotAuthenticated("No has iniciado sesión.".into()))?;
    let response = backend.send(Some(&token), &method, &path, &query.unwrap_or_default(), body.as_ref()).await?;
    if response.status == 401 {
        auth.expire(&app, message_text(&response.body)).await;
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::mpsc, thread};

    #[test]
    fn valida_rutas() {
        for ok in ["/post/local", "/eventos-pendientes/mismo-dia", "/login/google", "/post/export-locales"] {
            assert!(validate_path(ok).is_ok(), "{ok}");
        }
        for mala in ["post", "/../x", "//evil.com/x", "/a?b=1", "/a#b", "/a b", "https://evil.com", "/a/%2e%2e"] {
            assert!(validate_path(mala).is_err(), "{mala}");
        }
    }

    #[test]
    fn solo_metodos_conocidos() {
        assert_eq!(parse_method("patch").unwrap(), Method::PATCH);
        assert!(parse_method("TRACE").is_err());
    }

    #[test]
    fn mensajes_de_nest() {
        assert_eq!(message_text(&json!({ "message": ["a", "b"] })).as_deref(), Some("a. b"));
        assert_eq!(message_text(&json!({ "message": "Token inválido" })).as_deref(), Some("Token inválido"));
        assert_eq!(message_text(&json!({ "message": "  " })), None);
    }

    #[test]
    fn exige_https_salvo_en_local() {
        assert!(Backend::new("http://colimaapp.herokuapp.com/api").is_err());
        assert!(Backend::new("http://localhost:3000/api").is_ok());
        assert!(Backend::new("https://colimaapp.herokuapp.com/api/").is_ok());
    }

    #[test]
    fn carpetas_de_imagenes_como_el_backend() {
        for ok in ["magentagroup", "magentagroup/casas", "a_b-c/1"] {
            assert!(validate_folder(ok).is_ok(), "{ok}");
        }
        for mala in ["", "/", "a//b", "../x", "a/..", "a b", "a&b=1", "a?b", "ñ", &"x".repeat(65)] {
            assert!(validate_folder(mala).is_err(), "{mala}");
        }
    }

    /// La imagen viaja como multipart con `image` y `folder`, el token solo
    /// en la cabecera, y la respuesta (con la URL de Cloudinary) regresa tal
    /// cual. Magenta sube por /api/magentagroup/images (su propia cuenta de
    /// Cloudinary); /api/images sigue siendo la cuenta principal.
    #[tokio::test]
    async fn sube_la_imagen_como_multipart_con_el_token_en_la_cabecera() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            for _ in 0..UPLOAD_ENDPOINTS.len() {
                let mut request = server.recv().unwrap();
                let mut body = Vec::new();
                request.as_reader().read_to_end(&mut body).unwrap();
                let auth = request.headers().iter().find(|h| h.field.equiv("Authorization")).map(|h| h.value.to_string());
                let content_type = request.headers().iter().find(|h| h.field.equiv("Content-Type")).map(|h| h.value.to_string());
                tx.send((request.method().to_string(), request.url().to_owned(), auth, content_type, body)).unwrap();
                request
                    .respond(tiny_http::Response::from_string(r#"{"response":true,"url":"https://res.cloudinary.com/x/a.jpg"}"#))
                    .unwrap();
            }
        });

        let backend = Backend::new(&format!("http://127.0.0.1:{port}/api")).unwrap();
        let foto = vec![0xff, 0xd8, 0xff, 0xe0, b'J', b'F', b'I', b'F'];
        for endpoint in UPLOAD_ENDPOINTS {
            let res = backend.upload_image("jwt-de-prueba", endpoint, "magentagroup/properties", foto.clone()).await.unwrap();
            assert_eq!(res.status, 200);
            assert_eq!(res.body["url"], "https://res.cloudinary.com/x/a.jpg");

            let (method, url, auth, content_type, body) = rx.recv().unwrap();
            assert_eq!(method, "POST");
            assert_eq!(url, format!("/api{endpoint}"));
            assert_eq!(auth.as_deref(), Some("Bearer jwt-de-prueba"));
            assert!(content_type.unwrap().starts_with("multipart/form-data; boundary="));
            let texto = String::from_utf8_lossy(&body);
            assert!(texto.contains("name=\"folder\"\r\n\r\nmagentagroup/properties\r\n"), "{texto}");
            assert!(texto.contains("name=\"image\"; filename=\"image\""), "{texto}");
            assert!(body.windows(foto.len()).any(|w| w == foto.as_slice()), "los bytes de la imagen viajan intactos");
            assert!(!texto.contains("jwt-de-prueba"), "el token no va en el cuerpo");
        }
    }

    #[test]
    fn los_destinos_de_subida_son_rutas_validas_del_backend() {
        assert_eq!(UPLOAD_ENDPOINTS, ["/images", "/magentagroup/images"]);
        for endpoint in UPLOAD_ENDPOINTS {
            assert!(validate_path(endpoint).is_ok(), "{endpoint}");
        }
    }

    /// Lo mismo que comprobaba scripts/verificar-backend.js en la versión
    /// web: el token viaja en la cabecera Authorization y nunca en la
    /// query ni en el body; la ruta y el prefijo /api se conservan.
    #[tokio::test]
    async fn manda_el_token_solo_en_la_cabecera() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            for _ in 0..2 {
                let mut request = server.recv().unwrap();
                let mut body = String::new();
                request.as_reader().read_to_string(&mut body).unwrap();
                let auth = request
                    .headers()
                    .iter()
                    .find(|h| h.field.equiv("Authorization"))
                    .map(|h| h.value.to_string());
                tx.send((request.method().to_string(), request.url().to_owned(), auth, body)).unwrap();
                let respuesta = if request.url().starts_with("/api/html") { "<html>503</html>" } else { r#"{"response":true,"posts":[]}"# };
                request.respond(tiny_http::Response::from_string(respuesta)).unwrap();
            }
        });

        let backend = Backend::new(&format!("http://127.0.0.1:{port}/api")).unwrap();
        let query = BTreeMap::from([("estatus".to_owned(), "activo y más".to_owned())]);
        let res = backend
            .send(Some("jwt-de-prueba"), "PATCH", "/post/production/pause", &query, Some(&json!({ "id": "abc" })))
            .await
            .unwrap();
        assert_eq!(res.status, 200);
        assert_eq!(res.body["response"], true);

        let (method, url, auth, body) = rx.recv().unwrap();
        assert_eq!(method, "PATCH");
        assert_eq!(url, "/api/post/production/pause?estatus=activo+y+m%C3%A1s");
        assert_eq!(auth.as_deref(), Some("Bearer jwt-de-prueba"));
        assert_eq!(serde_json::from_str::<Value>(&body).unwrap(), json!({ "id": "abc" }));
        assert!(!url.contains("token") && !body.contains("token"));

        // Respuesta que no es JSON → body {} (Heroku a veces contesta HTML)
        let res = backend.send(Some("t"), "GET", "/html", &BTreeMap::new(), None).await.unwrap();
        assert_eq!(res.body, json!({}));
        let (method, _, _, body) = rx.recv().unwrap();
        assert_eq!(method, "GET");
        assert!(body.is_empty());
    }

    /// Contra el backend real de Heroku (necesita internet):
    ///   cargo test backend_real -- --ignored
    #[tokio::test]
    #[ignore]
    async fn backend_real() {
        let backend = Backend::new(crate::config::backend_url()).unwrap();

        // Un id_token inválido: el backend lo rechaza con su mensaje.
        match backend.login_google("token-invalido").await {
            Err(AppError::SignIn(mensaje)) => assert!(!mensaje.is_empty()),
            Err(otro) => panic!("error inesperado: {otro:?}"),
            Ok(_) => panic!("el backend aceptó un token inválido"),
        }

        // Una ruta protegida con un JWT falso: 401 con JSON.
        let res = backend.send(Some("jwt-falso"), "GET", "/eventos-pendientes", &BTreeMap::new(), None).await.unwrap();
        assert_eq!(res.status, 401);
        assert!(res.body.is_object());
    }
}
