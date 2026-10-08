//! Configuración fija de la app, compilada dentro del binario.
//!
//! Nada de esto es secreto: la URL del backend, el client id público de
//! Google (todo client id web se embebe en la página que lo usa) y el id
//! de la cuenta dueña. No hay ningún secreto en la app: la única
//! credencial es el JWT de la sesión, que vive en el Llavero de macOS.
//!
//! La URL del backend y el id de la cuenta se pueden cambiar al compilar
//! con las variables de entorno MYPROJECT_BACKEND_URL y
//! MYPROJECT_OWNER_USER_ID (por ejemplo, para apuntar a un backend local).

/// Backend remoto (NestJS en Heroku), con el prefijo /api que usa para
/// todas sus rutas.
pub fn backend_url() -> &'static str {
    option_env!("MYPROJECT_BACKEND_URL").unwrap_or("https://colimaapp.herokuapp.com/api")
}

/// Única cuenta que puede entrar a la app. Debe coincidir con
/// src/common/constants/admin.constant.ts en backColimaApp: el backend
/// responde con ese usuario al iniciar sesión y aquí se compara.
pub fn owner_user_id() -> &'static str {
    option_env!("MYPROJECT_OWNER_USER_ID").unwrap_or("6705a6ce37e1cf2548b7f44c")
}

/// Client id OAuth *web* de Google (el mismo GOOGLE_CLIENT_ID_WEB del
/// backend). El backend valida el id_token contra este client id, por eso
/// la app no usa un client id propio de escritorio.
pub const GOOGLE_WEB_CLIENT_ID: &str =
    "1099296294747-n5pk9f851nee646ce5vo437cp9ted6ms.apps.googleusercontent.com";

/// Puertos del servidor loopback del inicio de sesión, en orden de
/// preferencia. Google solo acepta orígenes registrados en el cliente web,
/// y estos dos (http://localhost:3001 y http://localhost:5173) ya lo están.
/// Si se agrega otro aquí, también hay que agregarlo en Google Cloud
/// Console → Credenciales → Orígenes de JavaScript autorizados.
pub const SIGN_IN_PORTS: [u16; 2] = [3001, 5173];

/// Cuánto espera la app a que termines de iniciar sesión en el navegador.
pub const SIGN_IN_TIMEOUT_SECS: u64 = 5 * 60;

/// Servicio del Llavero de macOS donde se guarda la sesión.
pub const KEYCHAIN_SERVICE: &str = "com.juliosantiago.myproject";
pub const KEYCHAIN_ACCOUNT: &str = "session";
