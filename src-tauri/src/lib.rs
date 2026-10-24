mod storage;

use std::path::PathBuf;

use tauri::ipc::Response;
use tauri::{AppHandle, Manager, State};

use storage::{FileInfo, ImportRequest, ImportedFile, PathRegistry, ProjectStore, ProjectSummary};

#[tauri::command]
fn list_projects(store: State<'_, ProjectStore>) -> Vec<ProjectSummary> {
    store.list()
}

/// Reads a project and authorises the audio files it references.
#[tauri::command]
fn read_project(
    store: State<'_, ProjectStore>,
    registry: State<'_, PathRegistry>,
    id: String,
) -> Result<Option<String>, String> {
    let contents = match store.read(&id) {
        Ok(Some(contents)) => contents,
        Ok(None) => return Ok(None),
        Err(error) => {
            return Err(format!(
                "No se pudo leer la presentación: {}",
                error
            ))
        }
    };
    authorise_project_assets(&contents, &registry);
    Ok(Some(contents))
}

#[tauri::command]
fn write_project(
    store: State<'_, ProjectStore>,
    id: String,
    contents: String,
) -> Result<String, String> {
    store
        .write(&id, &contents)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| error.to_string())
}

/// Creates an independent copy of a project, with its own resource folder.
#[tauri::command]
fn duplicate_project(
    store: State<'_, ProjectStore>,
    registry: State<'_, PathRegistry>,
    id: String,
    new_id: String,
) -> Result<String, String> {
    let contents = store
        .duplicate(&id, &new_id)
        .map_err(|error| error.to_string())?;
    authorise_project_assets(&contents, &registry);
    Ok(contents)
}

#[tauri::command]
fn delete_project(store: State<'_, ProjectStore>, id: String) -> Result<(), String> {
    store
        .delete(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn projects_dir(store: State<'_, ProjectStore>) -> String {
    store.root().to_string_lossy().to_string()
}

#[tauri::command]
fn project_dir(store: State<'_, ProjectStore>, id: String) -> String {
    store.project_dir(&id).to_string_lossy().to_string()
}

/// Copies the selected files into the project resources folder.
/// The originals are left untouched.
///
/// This is also the point where the backend authorises the files: the user
/// has just picked them explicitly, and the copies live inside the project.
#[tauri::command]
fn import_audio_files(
    store: State<'_, ProjectStore>,
    registry: State<'_, PathRegistry>,
    project_id: String,
    items: Vec<ImportRequest>,
) -> Result<Vec<ImportedFile>, String> {
    for item in &items {
        registry.allow_file(&item.source_path);
    }

    let imported = store
        .import_files(&project_id, &items)
        .map_err(|error| error.to_string())?;

    for file in &imported {
        registry.allow_file(&file.absolute_path);
    }

    Ok(imported)
}

/// Reads an audio file and returns its raw bytes.
///
/// The file must have been authorised first: it either comes from the file
/// picker (see `import_audio_files`) or it belongs to a project that the user
/// has opened (see `read_project`).
///
/// The read happens outside the main thread so a long track does not freeze
/// the interface.
#[tauri::command]
async fn read_audio_file(
    registry: State<'_, PathRegistry>,
    path: String,
) -> Result<Response, String> {
    if !registry.is_allowed(&path) {
        return Err(
            "Este archivo no está autorizado. Vuelve a importarlo desde la biblioteca."
                .to_string(),
        );
    }

    let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;

    Ok(Response::new(bytes))
}

/// Grants read access to a whole folder (used for the project resources).
#[tauri::command]
fn authorize_audio_directory(app: AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn file_info(path: String) -> FileInfo {
    let target = PathBuf::from(&path);
    let exists = target.is_file();
    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = target
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let size_bytes = target.metadata().map(|m| m.len()).unwrap_or(0);

    FileInfo {
        path,
        file_name,
        extension,
        size_bytes,
        exists,
    }
}

/// Lists the audio files of a folder (used by "importar desde una carpeta").
/// Only the extensions supported by the Web Audio engine are returned.
#[tauri::command]
fn list_audio_files(directory: String) -> Vec<String> {
    let dir = PathBuf::from(&directory);
    let mut files: Vec<String> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let extension = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if matches!(extension.as_str(), "wav" | "mp3" | "ogg") {
                files.push(path.to_string_lossy().to_string());
            }
        }
    }
    files.sort();
    files
}

/// Application version and build information for the diagnostics panel.
#[tauri::command]
fn app_info(app: AppHandle) -> serde_json::Value {
    let version = app.package_info().version.to_string();
    let name = app.package_info().name.to_string();
    serde_json::json!({
        "name": name,
        "version": version,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

/// Authorises every audio file referenced by a project document.
fn authorise_project_assets(contents: &str, registry: &PathRegistry) {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(contents) else {
        return;
    };
    let Some(assets) = value.get("assets").and_then(|a| a.as_array()) else {
        return;
    };
    for asset in assets {
        if let Some(path) = asset.get("absolutePath").and_then(|p| p.as_str()) {
            if !path.is_empty() {
                registry.allow_file(path);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let projects = data_dir.join("projects");
            let store = ProjectStore::new(projects.clone())?;
            app.manage(store);

            let registry = PathRegistry::new();
            registry.allow_root(&projects);
            app.manage(registry);

            // The project folder is also exposed through the asset protocol,
            // which allows the interface to preview the files directly.
            app.asset_protocol_scope()
                .allow_directory(&projects, true)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            read_project,
            write_project,
            duplicate_project,
            delete_project,
            projects_dir,
            project_dir,
            import_audio_files,
            read_audio_file,
            authorize_audio_directory,
            file_info,
            list_audio_files,
            app_info,
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar CueStage");
}
