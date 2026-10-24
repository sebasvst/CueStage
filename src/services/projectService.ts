import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './bridge';
import type { CueStageProject, ProjectSummary } from '../types';

export interface ImportRequest {
  id: string;
  sourcePath: string;
}

export interface ImportedFile {
  id: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  extension: string;
}

/**
 * Persistence layer for the projects.
 *
 * On the desktop the projects live in the application data folder and are
 * written atomically by the Rust backend. In a plain browser (development
 * only) the metadata is kept in `localStorage`.
 */
class TauriProjectService {
  async list(): Promise<ProjectSummary[]> {
    return invoke<ProjectSummary[]>('list_projects');
  }

  async read(id: string): Promise<CueStageProject | null> {
    const contents = await invoke<string | null>('read_project', { id });
    if (!contents) return null;
    return JSON.parse(contents) as CueStageProject;
  }

  async write(project: CueStageProject): Promise<void> {
    await invoke('write_project', {
      id: project.id,
      contents: JSON.stringify(project, null, 2),
    });
  }

  /**
   * Creates an independent copy of a project.
   *
   * The resources are copied too and the paths are rewritten by the backend,
   * so the copy keeps working on its own.
   */
  async duplicate(id: string, newId: string): Promise<string> {
    return invoke<string>('duplicate_project', { id, newId });
  }

  async remove(id: string): Promise<void> {
    await invoke('delete_project', { id });
  }

  async projectsDirectory(): Promise<string> {
    return invoke<string>('projects_dir');
  }

  async projectDirectory(id: string): Promise<string> {
    return invoke<string>('project_dir', { id });
  }

  async importFiles(
    projectId: string,
    items: ImportRequest[],
  ): Promise<ImportedFile[]> {
    return invoke<ImportedFile[]>('import_audio_files', { projectId, items });
  }
}

const WEB_PREFIX = 'cuestage:project:';

class WebProjectService {
  private indexKey = 'cuestage:project-index';

  async list(): Promise<ProjectSummary[]> {
    const ids = this.readIndex();
    const summaries: ProjectSummary[] = [];
    for (const id of ids) {
      const project = await this.read(id);
      if (!project) continue;
      summaries.push({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        path: '(navegador)',
        assetCount: project.assets.length,
        padCount: project.pads.length,
        hasMusic: Boolean(project.musicAssetId),
      });
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async read(id: string): Promise<CueStageProject | null> {
    const raw = localStorage.getItem(WEB_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CueStageProject;
    } catch {
      return null;
    }
  }

  async write(project: CueStageProject): Promise<void> {
    localStorage.setItem(WEB_PREFIX + project.id, JSON.stringify(project));
    const ids = this.readIndex();
    if (!ids.includes(project.id)) {
      ids.push(project.id);
      localStorage.setItem(this.indexKey, JSON.stringify(ids));
    }
  }

  /** Copy of a project with a new identifier. */
  async duplicate(id: string, newId: string): Promise<string> {
    const project = await this.read(id);
    if (!project) throw new Error('No se encontró el proyecto de origen.');
    const copy = { ...project, id: newId };
    const contents = JSON.stringify(copy, null, 2);
    await this.write(copy);
    return contents;
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(WEB_PREFIX + id);
    localStorage.setItem(
      this.indexKey,
      JSON.stringify(this.readIndex().filter((entry) => entry !== id)),
    );
  }

  async projectsDirectory(): Promise<string> {
    return '(almacenamiento local del navegador)';
  }

  async projectDirectory(): Promise<string> {
    return '(almacenamiento local del navegador)';
  }

  async importFiles(): Promise<ImportedFile[]> {
    throw new Error(
      'La importación de archivos requiere la aplicación de escritorio. En el navegador los archivos se cargan en memoria.',
    );
  }

  private readIndex(): string[] {
    try {
      const raw = localStorage.getItem(this.indexKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
}

export const projectService: TauriProjectService | WebProjectService = isTauri()
  ? new TauriProjectService()
  : new WebProjectService();
