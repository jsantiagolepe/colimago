fn main() {
    // config.rs lee estas variables al compilar.
    println!("cargo:rerun-if-env-changed=MYPROJECT_BACKEND_URL");
    println!("cargo:rerun-if-env-changed=MYPROJECT_OWNER_USER_ID");

    // Los comandos propios quedan sujetos a permisos: una ventana solo
    // puede llamar los que su capability (capabilities/*.json) le conceda.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_get_session",
            "auth_sign_in_google",
            "auth_cancel_sign_in",
            "auth_reopen_sign_in",
            "auth_sign_out",
            "backend_request",
            "resolve_maps_link",
            "save_text_file",
            "data_read",
            "data_write",
        ]),
    ))
    .expect("falló tauri-build");
}
