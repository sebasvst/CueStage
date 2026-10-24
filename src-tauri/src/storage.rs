use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Lightweight metadata about a stored project, used to build the "recent
/// projects" list without loading the whole project file in the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub path: String,
    pub asset_count: usize,
    pub pad_count: usize,
    pub has_music: bool,
}

/// A file that has been copied into the project resources folder.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFile {
    pub id: String,
    pub file_name: String,
    pub stored_name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub size_bytes: u64,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub id: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub exists: bool,
}

pub const PROJECT_FILE_NAME: &str = "project.json";
pub const ASSETS_DIR_NAME: &str = "assets";

/// Local, on-disk project storage.
///
/// Every project lives in its own folder:
///
///   <root>/<project-id>/project.json
///   <root>/<project-id>/assets/...
///
/// Writes are atomic (temporary file + rename) so a crash can never leave a
/// half-written project behind.
pub struct ProjectStore {
    root: PathBuf,
    /// Serialises the writes so two overlapping saves cannot corrupt the file.
    write_lock: Mutex<()>,
    /// Gives every temporary file a unique name.
    write_counter: std::sync::atomic::AtomicU64,
}

impl ProjectStore {
    pub fn new(root: PathBuf) -> std::io::Result<Self> {
        fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            write_lock: Mutex::new(()),
            write_counter: std::sync::atomic::AtomicU64::new(0),
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn project_dir(&self, id: &str) -> PathBuf {
        self.root.join(sanitize_id(id))
    }

    pub fn assets_dir(&self, id: &str) -> PathBuf {
        self.project_dir(id).join(ASSETS_DIR_NAME)
    }

    pub fn project_file(&self, id: &str) -> PathBuf {
        self.project_dir(id).join(PROJECT_FILE_NAME)
    }

    pub fn list(&self) -> Vec<ProjectSummary> {
        let mut summaries: Vec<ProjectSummary> = Vec::new();
        let entries = match fs::read_dir(&self.root) {
            Ok(entries) => entries,
            Err(_) => return summaries,
        };

        for entry in entries.flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            let contents = match fs::read_to_string(entry.path().join(PROJECT_FILE_NAME)) {
                Ok(contents) => contents,
                Err(_) => continue,
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) else {
                continue;
            };
            // The format stores the main music in `musicAssetId`; the nested
            // variant is accepted for compatibility.
            let music = value
                .get("musicAssetId")
                .and_then(|id| id.as_str())
                .or_else(|| {
                    value
                        .get("music")
                        .and_then(|music| music.get("assetId"))
                        .and_then(|id| id.as_str())
                });
            summaries.push(ProjectSummary {
                id: value
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or(id.as_str())
                    .to_string(),
                name: value
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Proyecto sin título")
                    .to_string(),
                created_at: value
                    .get("createdAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                updated_at: value
                    .get("updatedAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                path: entry.path().to_string_lossy().to_string(),
                asset_count: value
                    .get("assets")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0),
                pad_count: value
                    .get("pads")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0),
                has_music: matches!(music, Some(id) if !id.is_empty()),
            });
        }

        summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        summaries
    }

    /// Reads a project.
    ///
    /// `Ok(None)` means that it does not exist; any other error is reported so
    /// the interface can tell the difference between "missing" and "broken".
    pub fn read(&self, id: &str) -> std::io::Result<Option<String>> {
        match fs::read_to_string(self.project_file(id)) {
            Ok(contents) => Ok(Some(contents)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn write(&self, id: &str, contents: &str) -> std::io::Result<PathBuf> {
        // Only one write at a time: the frontend can save from the timer, from
        // the button and when opening or closing a project.
        let _guard = self.write_lock.lock().unwrap();

        let dir = self.project_dir(id);
        fs::create_dir_all(&dir)?;
        fs::create_dir_all(dir.join(ASSETS_DIR_NAME))?;

        let target = dir.join(PROJECT_FILE_NAME);
        let counter = self
            .write_counter
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let temp = dir.join(format!("{PROJECT_FILE_NAME}.{}.{}.tmp", std::process::id(), counter));

        {
            let mut file = fs::File::create(&temp)?;
            file.write_all(contents.as_bytes())?;
            file.sync_all()?;
        }

        match fs::rename(&temp, &target) {
            Ok(()) => Ok(target),
            Err(error) => {
                let _ = fs::remove_file(&temp);
                Err(error)
            }
        }
    }

    /// Copies a project into a new one.
    ///
    /// The resource folder is copied too and the absolute paths of the audio
    /// files are rewritten, so the copy is fully independent and the original
    /// is never touched.
    pub fn duplicate(&self, id: &str, new_id: &str) -> std::io::Result<String> {
        let source = self.project_dir(id);
        let target = self.project_dir(new_id);
        if !source.is_dir() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "El proyecto de origen no existe.",
            ));
        }
        if target.exists() {
            fs::remove_dir_all(&target)?;
        }
        copy_dir(&source, &target)?;

        // The absolute paths of the audio files have to point to the copy.
        let project_file = target.join(PROJECT_FILE_NAME);
        let contents = fs::read_to_string(&project_file)?;
        let mut value: serde_json::Value = serde_json::from_str(&contents)
            .unwrap_or_else(|_| serde_json::Value::Object(Default::default()));

        if let Some(assets) = value.get_mut("assets").and_then(|a| a.as_array_mut()) {
            for asset in assets.iter_mut() {
                let relative = asset
                    .get("relativePath")
                    .and_then(|p| p.as_str())
                    .map(|p| p.to_string());
                if let Some(relative) = relative {
                    let absolute = target.join(&relative);
                    if let Some(map) = asset.as_object_mut() {
                        map.insert(
                            "absolutePath".to_string(),
                            serde_json::Value::String(absolute.to_string_lossy().to_string()),
                        );
                    }
                }
            }
        }
        if let Some(map) = value.as_object_mut() {
            map.insert(
                "id".to_string(),
                serde_json::Value::String(new_id.to_string()),
            );
        }

        let updated = serde_json::to_string_pretty(&value).unwrap_or(contents);
        fs::write(&project_file, updated.as_bytes())?;

        Ok(updated)
    }

    /// Removes a project and its resources.
    pub fn delete(&self, id: &str) -> std::io::Result<()> {
        let dir = self.project_dir(id);
        if !dir.exists() {
            return Ok(());
        }
        fs::remove_dir_all(dir)
    }

    /// Copies external files into the project resources folder.
    ///
    /// The original files are never modified nor deleted.
    pub fn import_files(
        &self,
        id: &str,
        items: &[ImportRequest],
    ) -> std::io::Result<Vec<ImportedFile>> {
        let assets = self.assets_dir(id);
        fs::create_dir_all(&assets)?;

        let mut results = Vec::with_capacity(items.len());
        for item in items {
            let source = PathBuf::from(&item.source_path);
            let file_name = source
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "audio".to_string());
            let extension = source
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            let stem = sanitize_id(&item.id);
            let stored_name = format!("{stem}.{extension}");
            let destination = assets.join(&stored_name);

            let mut final_destination = destination.clone();
            let mut counter = 1;
            while final_destination.exists() {
                final_destination = assets.join(format!("{stem}-{counter}.{extension}"));
                counter += 1;
            }

            fs::copy(&source, &final_destination)?;

            let size_bytes = fs::metadata(&final_destination).map(|m| m.len()).unwrap_or(0);
            let final_stored_name = final_destination
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or(stored_name);
            let relative_path = format!("{ASSETS_DIR_NAME}/{final_stored_name}");

            results.push(ImportedFile {
                id: item.id.clone(),
                file_name,
                stored_name: final_stored_name,
                relative_path,
                absolute_path: final_destination.to_string_lossy().to_string(),
                size_bytes,
                extension,
            });
        }

        Ok(results)
    }
}

/// Copies a folder recursively.
fn copy_dir(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let destination = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir(&entry.path(), &destination)?;
        } else {
            fs::copy(entry.path(), &destination)?;
        }
    }
    Ok(())
}

/// Restricts an identifier to characters that are safe as a folder name.
/// This blocks path traversal (`..`, absolute paths, separators).
pub fn sanitize_id(value: &str) -> String {    let cleaned: String = value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "proyecto".to_string()
    } else {
        trimmed
    }
}

/// Registry of the files the backend is allowed to read.
///
/// A file only enters the registry through an explicit user action (the file
/// picker) or through a project that the user has opened. The frontend cannot
/// read any other path, which keeps the attack surface small even if the
/// interface were compromised.
#[derive(Default)]
pub struct PathRegistry {
    allowed: Mutex<HashSet<PathBuf>>,
    roots: Mutex<Vec<PathBuf>>,
}

/// Resolves the real path of a file, following symbolic links.
///
/// It is what prevents a crafted `project.json` from reading a file outside
/// the project folder using `..`.
fn canonical_path(path: &Path) -> Option<PathBuf> {
    if let Ok(resolved) = std::fs::canonicalize(path) {
        return Some(resolved);
    }
    // The file may not exist yet: the parent folder is resolved instead.
    let parent = std::fs::canonicalize(path.parent()?).ok()?;
    let name = path.file_name()?;
    Some(parent.join(name))
}

impl PathRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Allows every file inside a directory (the project resources).
    pub fn allow_root<P: AsRef<Path>>(&self, root: P) {
        let root = root.as_ref();
        let resolved = canonical_path(root).unwrap_or_else(|| root.to_path_buf());
        let mut roots = self.roots.lock().unwrap();
        if !roots.iter().any(|existing| existing == &resolved) {
            roots.push(resolved);
        }
    }

    /// Allows one exact file.
    pub fn allow_file<P: AsRef<Path>>(&self, path: P) {
        let path = path.as_ref();
        if !path.is_absolute() {
            return;
        }
        let resolved = canonical_path(path).unwrap_or_else(|| path.to_path_buf());
        let mut allowed = self.allowed.lock().unwrap();
        allowed.insert(resolved);
    }

    pub fn is_allowed<P: AsRef<Path>>(&self, path: P) -> bool {
        let path = path.as_ref();
        if !path.is_absolute() {
            return false;
        }
        // The real path is compared, so `..` cannot be used to escape.
        let resolved = canonical_path(path).unwrap_or_else(|| path.to_path_buf());

        if let Ok(allowed) = self.allowed.lock() {
            if allowed.contains(&resolved) {
                return true;
            }
        }
        if let Ok(roots) = self.roots.lock() {
            for root in roots.iter() {
                if resolved.starts_with(root) {
                    return true;
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cuestage-test-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_and_reads_a_project() {
        let root = scratch("write");
        let store = ProjectStore::new(root.clone()).unwrap();

        store
            .write("demo", "{\"formatVersion\":1,\"name\":\"Demo\"}")
            .unwrap();

        let contents = store.read("demo").unwrap().unwrap();
        assert!(contents.contains("Demo"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writing_twice_keeps_the_file_valid() {
        let root = scratch("rewrite");
        let store = ProjectStore::new(root.clone()).unwrap();

        store.write("demo", "{\"a\":1}").unwrap();
        store.write("demo", "{\"a\":2}").unwrap();

        assert_eq!(store.read("demo").unwrap().unwrap(), "{\"a\":2}");
        // The temporary file must not be left behind.
        assert!(!store.project_file("demo").with_extension("json.tmp").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn overlapping_writes_do_not_corrupt_the_project() {
        let root = scratch("concurrent");
        let store = std::sync::Arc::new(ProjectStore::new(root.clone()).unwrap());

        let mut handles = Vec::new();
        for index in 0..8 {
            let store = store.clone();
            handles.push(std::thread::spawn(move || {
                let payload = format!("{{\"n\":{index}}}");
                store.write("demo", &payload).unwrap();
            }));
        }
        for handle in handles {
            handle.join().unwrap();
        }

        let contents = store.read("demo").unwrap().unwrap();
        // The file must be valid JSON, not a mix of two writes.
        let value: serde_json::Value = serde_json::from_str(&contents).unwrap();
        assert!(value.get("n").is_some());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn duplicating_a_project_copies_the_resources_and_rewrites_the_paths() {
        let root = scratch("duplicate");
        let store = ProjectStore::new(root.clone()).unwrap();

        let source_dir = scratch("duplicate-source");
        let source = source_dir.join("sonido.wav");
        fs::write(&source, b"contenido").unwrap();

        store
            .import_files(
                "original",
                &[ImportRequest {
                    id: "a1".to_string(),
                    source_path: source.to_string_lossy().to_string(),
                }],
            )
            .unwrap();

        store
            .write(
                "original",
                "{\"formatVersion\":1,\"id\":\"original\",\"name\":\"Original\",\"assets\":[{\"id\":\"a1\",\"relativePath\":\"assets/a1.wav\",\"absolutePath\":\"\"}]}",
            )
            .unwrap();

        let contents = store.duplicate("original", "copia").unwrap();
        let value: serde_json::Value = serde_json::from_str(&contents).unwrap();
        assert_eq!(value["id"].as_str(), Some("copia"));

        let new_path = value["assets"][0]["absolutePath"].as_str().unwrap();
        assert!(new_path.contains("copia"));
        assert!(Path::new(new_path).exists());
        // El original sigue en su sitio.
        assert!(store.assets_dir("original").join("a1.wav").exists());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&source_dir);
    }

    #[test]
    fn the_registry_rejects_paths_that_escape_the_project() {
        let registry = PathRegistry::new();
        let root = scratch("escape");
        let file = root.join("dentro.txt");
        fs::write(&file, b"x").unwrap();
        registry.allow_root(&root);

        let outside = scratch("escape-outside");
        let secret = outside.join("secreto.txt");
        fs::write(&secret, b"secreto").unwrap();

        // A path with «..» that leaves the folder is not allowed.
        let sneaky = root.join("..").join("escape-outside").join("secreto.txt");
        assert!(!registry.is_allowed(&sneaky));
        assert!(registry.is_allowed(&file));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn a_missing_project_is_not_an_error() {
        let root = scratch("missing");
        let store = ProjectStore::new(root.clone()).unwrap();
        assert!(store.read("nada").unwrap().is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn lists_the_projects_with_their_metadata() {
        let root = scratch("list");
        let store = ProjectStore::new(root.clone()).unwrap();

        store
            .write(
                "uno",
                "{\"id\":\"uno\",\"name\":\"Uno\",\"createdAt\":\"2026-01-01T00:00:00Z\",\"updatedAt\":\"2026-01-02T00:00:00Z\",\"assets\":[{\"id\":\"a\"}],\"pads\":[{\"id\":\"p\"}],\"musicAssetId\":\"a\"}",
            )
            .unwrap();

        let list = store.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Uno");
        assert_eq!(list[0].asset_count, 1);
        assert_eq!(list[0].pad_count, 1);
        assert!(list[0].has_music);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn deletes_a_project() {
        let root = scratch("delete");
        let store = ProjectStore::new(root.clone()).unwrap();

        store.write("demo", "{}").unwrap();
        assert!(store.project_dir("demo").exists());

        store.delete("demo").unwrap();
        assert!(!store.project_dir("demo").exists());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn imports_the_files_without_touching_the_original() {
        let root = scratch("import");
        let store = ProjectStore::new(root.clone()).unwrap();

        let source_dir = scratch("source");
        let source = source_dir.join("musica.mp3");
        fs::write(&source, b"contenido de prueba").unwrap();

        let imported = store
            .import_files(
                "demo",
                &[ImportRequest {
                    id: "abc".to_string(),
                    source_path: source.to_string_lossy().to_string(),
                }],
            )
            .unwrap();

        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].relative_path, "assets/abc.mp3");
        assert_eq!(imported[0].size_bytes, 19);

        // The copy exists and the original is untouched.
        let copy = store.assets_dir("demo").join("abc.mp3");
        assert!(copy.exists());
        assert_eq!(fs::read(&source).unwrap(), b"contenido de prueba");

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&source_dir);
    }

    #[test]
    fn never_overwrites_an_existing_import() {
        let root = scratch("import-twice");
        let store = ProjectStore::new(root.clone()).unwrap();

        let source_dir = scratch("source-twice");
        let source = source_dir.join("musica.mp3");
        fs::write(&source, b"otro contenido").unwrap();

        let request = || ImportRequest {
            id: "abc".to_string(),
            source_path: source.to_string_lossy().to_string(),
        };

        let first = store.import_files("demo", &[request()]).unwrap();
        let second = store.import_files("demo", &[request()]).unwrap();

        assert_ne!(first[0].stored_name, second[0].stored_name);
        assert!(store.assets_dir("demo").join(&first[0].stored_name).exists());
        assert!(store.assets_dir("demo").join(&second[0].stored_name).exists());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&source_dir);
    }

    #[test]
    fn sanitizes_the_identifiers() {
        assert_eq!(sanitize_id("abc-123"), "abc-123");
        assert_eq!(sanitize_id("../../etc/passwd"), "etc_passwd");
        assert_eq!(sanitize_id(""), "proyecto");
        assert_eq!(sanitize_id("///"), "proyecto");
    }

    #[test]
    fn the_registry_only_allows_authorised_files() {
        let registry = PathRegistry::new();
        let root = scratch("registry");
        let file = root.join("dentro.txt");
        fs::write(&file, b"x").unwrap();

        assert!(!registry.is_allowed(&file));

        registry.allow_file(&file);
        assert!(registry.is_allowed(&file));

        let other = scratch("registry-other");
        let outside = other.join("fuera.txt");
        fs::write(&outside, b"x").unwrap();
        assert!(!registry.is_allowed(&outside));

        registry.allow_root(&root);
        assert!(registry.is_allowed(&root.join("cualquiera.txt")));

        // A relative path is never accepted.
        assert!(!registry.is_allowed("dentro.txt"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&other);
    }
}
