// Evita la consola extra en Windows en release. No quitar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    myproject_lib::run();
}
