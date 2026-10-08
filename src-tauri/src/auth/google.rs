//! Inicio de sesión con Google para una app de escritorio, siguiendo
//! RFC 8252 ("OAuth 2.0 for Native Apps"): navegador del sistema + loopback.
//!
//! Google no permite iniciar sesión dentro de un webview embebido y no
//! acepta `tauri://localhost` como origen, así que el botón de Google que
//! usaba la web no puede vivir dentro de la ventana de la app. En su lugar:
//!
//!   1. La app levanta un servidor HTTP efímero en http://localhost:3001
//!      (o :5173), orígenes que ya están autorizados en el cliente OAuth web.
//!   2. Abre esa página en tu navegador. La página usa Google Identity
//!      Services —el mismo botón y el mismo client id que la web— y obtiene
//!      el id_token de Google.
//!   3. La página regresa el id_token al servidor por POST, junto con un
//!      `state` aleatorio que solo conocen la app y esa página.
//!   4. La app revisa `state`, y en el id_token `nonce`, `aud`, `iss` y
//!      `exp`; luego se lo pasa al backend, que es quien verifica la firma
//!      (como antes hacía server.js con el `credential` del botón).
//!
//! El servidor solo escucha en 127.0.0.1 y ::1, solo acepta el Host y el
//! Origin esperados (contra DNS rebinding y peticiones de otras páginas),
//! entrega una sola credencial y se apaga al terminar o al cancelar.

use std::{
    io::{self, Read},
    net::{Ipv6Addr, SocketAddr, TcpListener},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use serde::Deserialize;
use serde_json::{Value, json};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
use tokio::sync::oneshot;

use crate::{
    config,
    error::AppError,
    jwt::{self, constant_time_eq},
};

const MAX_BODY_BYTES: u64 = 64 * 1024;
const SIGN_IN_PAGE: &str = include_str!("sign_in_page.html");

/// El id_token que mandó la página. Guarda la petición HTTP abierta para
/// contestarle a la página cómo terminó todo (entraste o por qué no).
pub struct Credential {
    pub id_token: String,
    request: Request,
}

impl Credential {
    pub fn reply_ok(self, name: &str) {
        respond_json(self.request, 200, &json!({ "ok": true, "name": name }));
    }

    pub fn reply_error(self, message: &str) {
        respond_json(self.request, 400, &json!({ "ok": false, "error": message }));
    }
}

/// Un intento de inicio de sesión en curso. Al soltarlo se apaga el servidor.
pub struct BrowserSignIn {
    url: String,
    nonce: String,
    receiver: oneshot::Receiver<Credential>,
    stop: Arc<AtomicBool>,
    servers: Vec<Arc<Server>>,
}

struct Shared {
    host: String,
    origin: String,
    state: String,
    nonce: String,
    sender: Mutex<Option<oneshot::Sender<Credential>>>,
}

impl BrowserSignIn {
    pub fn start() -> Result<Self, AppError> {
        let (port, listeners) = config::SIGN_IN_PORTS
            .iter()
            .find_map(|&port| bind_loopback(port).map(|listeners| (port, listeners)))
            .ok_or_else(|| {
                AppError::SignIn(format!(
                    "Otra aplicación está usando los puertos {}. Ciérrala e inténtalo de nuevo.",
                    config::SIGN_IN_PORTS.map(|p| p.to_string()).join(" y ")
                ))
            })?;

        let state = random_token();
        let nonce = random_token();
        let (sender, receiver) = oneshot::channel();
        let shared = Arc::new(Shared {
            host: format!("localhost:{port}"),
            origin: format!("http://localhost:{port}"),
            state: state.clone(),
            nonce: nonce.clone(),
            sender: Mutex::new(Some(sender)),
        });

        let stop = Arc::new(AtomicBool::new(false));
        let mut servers = Vec::new();
        for listener in listeners {
            let server = Server::from_listener(listener, None)
                .map(Arc::new)
                .map_err(|e| AppError::Internal(format!("No se pudo iniciar el servidor de inicio de sesión: {e}")))?;
            servers.push(server.clone());
            let (shared, stop) = (shared.clone(), stop.clone());
            thread::Builder::new()
                .name("inicio-sesion-loopback".into())
                .spawn(move || serve(&server, &shared, &stop))
                .map_err(|e| AppError::Internal(format!("No se pudo iniciar el servidor de inicio de sesión: {e}")))?;
        }

        log::info!("inicio de sesión: esperando en http://localhost:{port}");
        Ok(Self {
            url: format!("http://localhost:{port}/signin?state={state}"),
            nonce,
            receiver,
            stop,
            servers,
        })
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    /// Espera a que la página del navegador mande la credencial.
    pub async fn credential(&mut self) -> Result<Credential, AppError> {
        (&mut self.receiver)
            .await
            .map_err(|_| AppError::Internal("El servidor de inicio de sesión se detuvo.".into()))
    }

    /// Revisa que el id_token sea de Google, para esta app y para este
    /// intento (nonce), y que no haya vencido.
    pub fn check_id_token(&self, id_token: &str) -> Result<(), AppError> {
        check_claims(id_token, &self.nonce, jwt::now_secs())
    }
}

impl Drop for BrowserSignIn {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        for server in &self.servers {
            server.unblock();
        }
    }
}

/// Escucha en 127.0.0.1 y ::1 del mismo puerto. El navegador resuelve
/// "localhost" a cualquiera de los dos; si otro proceso ocupa ::1 en ese
/// puerto, el navegador podría hablarle a él, así que el puerto no sirve.
fn bind_loopback(port: u16) -> Option<Vec<TcpListener>> {
    let v4 = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], port))).ok()?;
    match TcpListener::bind(SocketAddr::from((Ipv6Addr::LOCALHOST, port))) {
        Ok(v6) => Some(vec![v4, v6]),
        Err(err) if err.kind() == io::ErrorKind::AddrInUse => None,
        Err(_) => Some(vec![v4]), // equipo sin IPv6
    }
}

fn serve(server: &Server, shared: &Shared, stop: &AtomicBool) {
    while !stop.load(Ordering::SeqCst) {
        match server.recv_timeout(Duration::from_millis(250)) {
            Ok(Some(request)) => handle(request, shared),
            Ok(None) => {}
            Err(err) => {
                log::warn!("inicio de sesión: el servidor loopback falló: {err}");
                break;
            }
        }
    }
}

fn handle(request: Request, shared: &Shared) {
    if !header(&request, "Host").is_some_and(|host| host.eq_ignore_ascii_case(&shared.host)) {
        return respond(request, 400, "text/plain; charset=utf-8", "Host no permitido.".into(), &[]);
    }
    let url = request.url().to_owned();
    let (path, query) = url.split_once('?').unwrap_or((url.as_str(), ""));
    match (request.method(), path) {
        (Method::Get, "/signin") => {
            let state_ok = url::form_urlencoded::parse(query.as_bytes())
                .find(|(key, _)| key == "state")
                .is_some_and(|(_, value)| constant_time_eq(&value, &shared.state));
            if state_ok {
                send_sign_in_page(request, shared);
            } else {
                send_message_page(
                    request,
                    403,
                    "Este enlace ya no es válido",
                    "Vuelve a MyProject y pulsa «Continuar con Google» otra vez.",
                );
            }
        }
        (Method::Post, "/callback") => handle_callback(request, shared),
        (Method::Get, "/favicon.ico") => respond(request, 204, "text/plain", String::new(), &[]),
        _ => respond(request, 404, "text/plain; charset=utf-8", "No encontrado.".into(), &[]),
    }
}

fn handle_callback(mut request: Request, shared: &Shared) {
    if header(&request, "Origin") != Some(shared.origin.as_str()) {
        return respond_json(request, 403, &json!({ "ok": false, "error": "Origen no permitido." }));
    }
    if !header(&request, "Content-Type").is_some_and(|c| c.starts_with("application/json")) {
        return respond_json(request, 415, &json!({ "ok": false, "error": "Se esperaba JSON." }));
    }

    let mut body = String::new();
    let leido = request.as_reader().take(MAX_BODY_BYTES + 1).read_to_string(&mut body);
    if leido.is_err() || body.len() as u64 > MAX_BODY_BYTES {
        return respond_json(request, 413, &json!({ "ok": false, "error": "Petición inválida." }));
    }

    #[derive(Deserialize)]
    struct Payload {
        state: String,
        credential: String,
    }
    let payload = match serde_json::from_str::<Payload>(&body) {
        Ok(payload) if constant_time_eq(&payload.state, &shared.state) => payload,
        _ => return respond_json(request, 403, &json!({ "ok": false, "error": "Petición inválida." })),
    };

    let sender = shared.sender.lock().ok().and_then(|mut slot| slot.take());
    match sender {
        Some(sender) => {
            if let Err(credential) = sender.send(Credential { id_token: payload.credential, request }) {
                credential.reply_error("MyProject ya no está esperando este inicio de sesión. Vuelve a la app e inténtalo de nuevo.");
            }
        }
        None => respond_json(
            request,
            409,
            &json!({ "ok": false, "error": "Este inicio de sesión ya se usó. Vuelve a MyProject." }),
        ),
    }
}

fn check_claims(id_token: &str, nonce: &str, now: u64) -> Result<(), AppError> {
    let invalid = || AppError::SignIn("Google no devolvió una credencial válida. Inténtalo de nuevo.".into());
    let claims = jwt::payload(id_token).ok_or_else(invalid)?;
    let aud_ok = claims["aud"].as_str() == Some(config::GOOGLE_WEB_CLIENT_ID);
    let iss_ok = matches!(claims["iss"].as_str(), Some("accounts.google.com" | "https://accounts.google.com"));
    let nonce_ok = claims["nonce"].as_str().is_some_and(|n| constant_time_eq(n, nonce));
    let exp_ok = claims["exp"].as_u64().is_some_and(|exp| exp > now);
    if aud_ok && iss_ok && nonce_ok && exp_ok {
        Ok(())
    } else {
        log::warn!("id_token rechazado: aud={aud_ok} iss={iss_ok} nonce={nonce_ok} exp={exp_ok}");
        Err(invalid())
    }
}

fn send_sign_in_page(request: Request, shared: &Shared) {
    let csp_nonce = random_token();
    let html = SIGN_IN_PAGE
        .replace("{{CSP_NONCE}}", &csp_nonce)
        .replace("{{CLIENT_ID}}", config::GOOGLE_WEB_CLIENT_ID)
        .replace("{{NONCE}}", &shared.nonce)
        .replace("{{STATE}}", &shared.state);
    // Lo que Google Identity Services necesita según su documentación, y
    // nada más. Sin COOP same-origin: rompería la ventana emergente de Google.
    let csp = format!(
        "default-src 'none'; script-src 'nonce-{csp_nonce}' https://accounts.google.com/gsi/client; \
         style-src 'unsafe-inline' https://accounts.google.com/gsi/style; \
         frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; \
         img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    respond(
        request,
        200,
        "text/html; charset=utf-8",
        html,
        &[
            ("Content-Security-Policy", csp.as_str()),
            ("Cross-Origin-Opener-Policy", "same-origin-allow-popups"),
        ],
    );
}

fn send_message_page(request: Request, status: u16, title: &str, text: &str) {
    let html = format!(
        "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>MyProject</title>\
         <body style=\"font:16px -apple-system,system-ui,sans-serif;max-width:32rem;margin:18vh auto;padding:0 24px;color:#1d1d1f\">\
         <h1 style=\"font-size:22px\">{title}</h1><p>{text}</p></body></html>"
    );
    respond(request, status, "text/html; charset=utf-8", html, &[("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")]);
}

fn respond_json(request: Request, status: u16, body: &Value) {
    respond(request, status, "application/json", body.to_string(), &[]);
}

fn respond(request: Request, status: u16, content_type: &str, body: String, extra: &[(&str, &str)]) {
    let mut response = Response::from_data(body.into_bytes()).with_status_code(StatusCode(status));
    let base = [
        ("Content-Type", content_type),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
        ("Referrer-Policy", "no-referrer"),
    ];
    for (name, value) in base.iter().chain(extra) {
        if let Ok(header) = Header::from_bytes(name.as_bytes(), value.as_bytes()) {
            response.add_header(header);
        }
    }
    if let Err(err) = request.respond(response) {
        log::warn!("inicio de sesión: no se pudo responder al navegador: {err}");
    }
}

fn header<'a>(request: &'a Request, name: &'static str) -> Option<&'a str> {
    request
        .headers()
        .iter()
        .find(|h| h.field.equiv(name))
        .map(|h| h.value.as_str())
}

fn random_token() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("el sistema no pudo generar números aleatorios");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;

    fn claims(nonce: &str, exp: u64) -> Value {
        json!({ "aud": config::GOOGLE_WEB_CLIENT_ID, "iss": "https://accounts.google.com", "nonce": nonce, "exp": exp })
    }

    #[test]
    fn acepta_un_id_token_valido() {
        let token = jwt::fake_token(&claims("n1", 2_000));
        assert!(check_claims(&token, "n1", 1_000).is_ok());
    }

    #[test]
    fn rechaza_otro_nonce_audiencia_emisor_o_vencido() {
        assert!(check_claims(&jwt::fake_token(&claims("otro", 2_000)), "n1", 1_000).is_err());
        assert!(check_claims(&jwt::fake_token(&claims("n1", 999)), "n1", 1_000).is_err());
        let mut c = claims("n1", 2_000);
        c["aud"] = json!("otra-app.apps.googleusercontent.com");
        assert!(check_claims(&jwt::fake_token(&c), "n1", 1_000).is_err());
        let mut c = claims("n1", 2_000);
        c["iss"] = json!("https://evil.example");
        assert!(check_claims(&jwt::fake_token(&c), "n1", 1_000).is_err());
        assert!(check_claims("basura", "n1", 1_000).is_err());
    }

    #[test]
    fn tokens_aleatorios_distintos() {
        let (a, b) = (random_token(), random_token());
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
    }

    /// El servidor loopback completo: página, Host, Origin, state y uso único.
    #[tokio::test]
    async fn servidor_loopback() {
        let mut flow = BrowserSignIn::start().expect("puertos ocupados");
        let url = Url::parse(flow.url()).unwrap();
        let base = format!("http://localhost:{}", url.port().unwrap());
        let state = url.query_pairs().find(|(k, _)| k == "state").unwrap().1.into_owned();
        // Sin reutilizar conexiones: así cada petición prueba el servidor
        // tal cual (y la última comprueba que el puerto ya se cerró).
        let http = reqwest::Client::builder()
            .pool_max_idle_per_host(0)
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        // La página solo se sirve con el state correcto y el Host esperado.
        let pagina = http.get(flow.url()).send().await.unwrap();
        assert_eq!(pagina.status(), 200);
        let csp = pagina.headers()["content-security-policy"].to_str().unwrap().to_owned();
        assert!(csp.contains("https://accounts.google.com/gsi/client") && csp.contains("default-src 'none'"));
        let html = pagina.text().await.unwrap();
        assert!(html.contains(config::GOOGLE_WEB_CLIENT_ID) && html.contains(&state) && !html.contains("{{"));
        assert_eq!(http.get(format!("{base}/signin?state=otro")).send().await.unwrap().status(), 403);
        let host_ajeno = http.get(flow.url()).header("Host", "evil.example").send().await.unwrap();
        assert_eq!(host_ajeno.status(), 400);

        let enviar = |origin: &str, state: &str| {
            http.post(format!("{base}/callback"))
                .header("Origin", origin)
                .json(&json!({ "state": state, "credential": "id-token-de-prueba" }))
                .send()
        };
        // Otra página del navegador (otro Origin) o un state falso: rechazados.
        assert_eq!(enviar("https://evil.example", &state).await.unwrap().status(), 403);
        assert_eq!(enviar(&base, "state-falso").await.unwrap().status(), 403);

        // La buena: la app recibe el id_token y le contesta a la página.
        let peticion = tokio::spawn(enviar(&base, &state));
        let credential = flow.credential().await.unwrap();
        assert_eq!(credential.id_token, "id-token-de-prueba");
        credential.reply_ok("Julio");
        let respuesta = peticion.await.unwrap().unwrap();
        assert_eq!(respuesta.json::<Value>().await.unwrap(), json!({ "ok": true, "name": "Julio" }));

        // Una sola credencial por intento.
        assert_eq!(enviar(&base, &state).await.unwrap().status(), 409);

        // Al soltarlo, el puerto queda libre.
        drop(flow);
        tokio::time::sleep(Duration::from_millis(600)).await;
        assert!(http.get(format!("{base}/favicon.ico")).send().await.is_err());
    }

    /// Para probar la página a mano o con un navegador headless:
    ///   cargo test pagina_de_login_manual -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn pagina_de_login_manual() {
        let mut flow = BrowserSignIn::start().unwrap();
        println!("URL={}", flow.url());
        let _ = tokio::time::timeout(Duration::from_secs(90), flow.credential()).await;
    }
}
