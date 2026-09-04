fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=app-icon.png");
    println!("cargo:rerun-if-changed=icon-work/app-icon-dock.png");
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
