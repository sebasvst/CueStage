import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileMusic,
  FolderOpen,
  Music,
  Play,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { EmptyState } from '../../components/common/Controls';
import { audioController } from '../live-mode/audioController';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { formatBytes, formatDuration } from '../../utils/format';
import { isTauri } from '../../services/bridge';
import {
  importFileHandles,
  importPaths,
  importWithFilePicker,
  importWithFolderPicker,
  onFileDrop,
} from './importService';
import { onFileImportRequest } from './importRequest';
import type { AudioAsset } from '../../types';

type SortKey = 'name' | 'date' | 'duration' | 'size';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Nombre',
  date: 'Fecha de importación',
  duration: 'Duración',
  size: 'Tamaño',
};

export function LibraryPanel() {
  const project = useProjectStore((state) => state.project);
  const addAsset = useProjectStore((state) => state.addAssetWithButton);
  const removeAsset = useProjectStore((state) => state.removeAsset);
  const setMusicAsset = useProjectStore((state) => state.setMusicAsset);
  const missingAssetIds = useProjectStore((state) => state.missingAssetIds);
  const pushToast = useUiStore((state) => state.pushToast);
  const preparation = useAudioStore((state) => state.preparation);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectIdRef = useRef<string | null>(null);

  useEffect(() => {
    projectIdRef.current = project?.id ?? null;
  }, [project?.id]);

  const assets = useMemo(() => project?.assets ?? [], [project?.assets]);
  const musicAssetId = project?.musicAssetId ?? null;

  const handleImportPaths = useCallback(
    async (paths: string[]) => {
      const projectId = projectIdRef.current;
      if (!projectId) return;
      setBusy(true);
      try {
        const outcome = await importPaths(projectId, paths);
        if (outcome.assets.length > 0) {
          for (const asset of outcome.assets) addAsset(asset);
          pushToast(
            `${outcome.assets.length} archivo(s) añadidos. Se ha creado un botón para cada uno.`,
            'success',
          );
        }
        if (outcome.skipped.length > 0) {
          pushToast(
            `${outcome.skipped.length} archivo(s) omitidos por formato no compatible.`,
            'warning',
          );
        }
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : 'No se pudo importar el archivo.',
          'error',
        );
      } finally {
        setBusy(false);
      }
    },
    [addAsset, pushToast],
  );

  useEffect(() => {
    return onFileDrop(
      (paths) => {
        void handleImportPaths(paths);
      },
      setDragging,
    );
  }, [handleImportPaths]);

  const handlePickFiles = async () => {
    if (!project) return;
    setBusy(true);
    try {
      if (isTauri()) {
        const outcome = await importWithFilePicker(project.id);
        if (!outcome) return;
        for (const asset of outcome.assets) addAsset(asset);
        if (outcome.assets.length) {
          pushToast(
            `${outcome.assets.length} archivo(s) añadidos. Se ha creado un botón para cada uno.`,
            'success',
          );
        }
        if (outcome.skipped.length) {
          pushToast(
            `${outcome.skipped.length} archivo(s) omitidos por formato no compatible.`,
            'warning',
          );
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo abrir el selector.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  // The tutorial guide can ask the library to open the file picker.
  const pickFilesRef = useRef(handlePickFiles);
  useEffect(() => {
    pickFilesRef.current = handlePickFiles;
  });

  useEffect(() => {
    return onFileImportRequest(() => {
      void pickFilesRef.current();
    });
  }, []);

  const handlePickFolder = async () => {
    if (!project || !isTauri()) return;
    setBusy(true);
    try {
      const outcome = await importWithFolderPicker(project.id);
      if (!outcome) return;
      for (const asset of outcome.assets) addAsset(asset);
      pushToast(
        outcome.assets.length > 0
          ? `${outcome.assets.length} archivo(s) añadidos de la carpeta. Se ha creado un botón para cada uno.`
          : 'La carpeta no contiene archivos de audio compatibles.',
        outcome.assets.length > 0 ? 'success' : 'warning',
      );
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo leer la carpeta.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleBrowserFiles = async (files: File[]) => {
    if (!project || files.length === 0) return;
    setBusy(true);
    try {
      const outcome = await importFileHandles(files);
      for (const asset of outcome.assets) addAsset(asset);
      pushToast(
        `${outcome.assets.length} archivo(s) añadidos. Se ha creado un botón para cada uno.`,
        'success',
      );
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudieron añadir los archivos.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? assets.filter((asset) => asset.name.toLowerCase().includes(needle))
      : [...assets];
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'date':
          return b.addedAt.localeCompare(a.addedAt);
        case 'duration':
          return (b.durationSec ?? 0) - (a.durationSec ?? 0);
        case 'size':
          return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
        default:
          return a.name.localeCompare(b.name, 'es');
      }
    });
  }, [assets, query, sort]);

  if (!project) return null;

  return (
    <section className="card">
      <div className="card__header">
        <div className="card__heading">
          <h3 className="card__title">Tus archivos</h3>
          <p className="card__description">
            Se copian dentro de la presentación. Tus archivos originales no se tocan.
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void handlePickFiles()}
            disabled={busy}
          >
            <Upload size={15} />
            Añadir archivos
          </button>
          {isTauri() ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void handlePickFolder()}
              disabled={busy}
            >
              <FolderOpen size={15} />
              Añadir una carpeta
            </button>
          ) : null}
        </div>
      </div>

      <div className="library-toolbar">
        <div className="library-search">
          <Search size={15} className="library-search__icon" />
          <input
            className="input"
            type="search"
            placeholder="Buscar por nombre…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar en la biblioteca"
          />
        </div>
        <select
          className="select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Ordenar la biblioteca"
          style={{ maxWidth: 200 }}
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              Ordenar por {label.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="dropzone" data-active={dragging}>
        <FileMusic size={22} />
        <span className="dropzone__title">
          {dragging ? 'Suelta para añadirlos' : 'Arrastra aquí tus archivos de sonido'}
        </span>
        <span className="field__hint">Formatos admitidos: MP3, WAV y OGG.</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileMusic size={22} />}
          title={assets.length === 0 ? 'Todavía no hay archivos' : 'No hay resultados'}
          description={
            assets.length === 0
              ? 'Pulsa «Añadir archivos» para elegir la música y los sonidos de la actuación.'
              : 'Ningún archivo coincide con la búsqueda.'
          }
        />
      ) : (
        <div className="library-list">
          {visible.map((asset) => (
            <LibraryRow
              key={asset.id}
              asset={asset}
              isMusic={asset.id === musicAssetId}
              missing={missingAssetIds.includes(asset.id)}
              preparing={preparation[asset.id]?.state === 'loading'}
              onPreview={() => void audioController.previewAsset(asset)}
              onToggleMusic={() =>
                setMusicAsset(asset.id === musicAssetId ? null : asset.id)
              }
              onRemove={() => removeAsset(asset.id)}
            />
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
        style={{ display: 'none' }}
        onChange={(event) => {
          // The list has to be copied before clearing the input: the FileList
          // is live and empties as soon as the value is reset.
          const list = Array.from(event.target.files ?? []);
          event.target.value = '';
          void handleBrowserFiles(list);
        }}
      />
    </section>
  );
}

function LibraryRow({
  asset,
  isMusic,
  missing,
  preparing,
  onPreview,
  onToggleMusic,
  onRemove,
}: {
  asset: AudioAsset;
  isMusic: boolean;
  missing: boolean;
  preparing: boolean;
  onPreview: () => void;
  onToggleMusic: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="library-row">
      <span className="library-row__icon">
        {missing ? <TriangleAlert size={16} /> : <FileMusic size={16} />}
      </span>
      <div className="library-row__body">
        <span className="library-row__name">{asset.name}</span>
        <span className="library-row__meta">
          <span className="badge">{asset.format.toUpperCase()}</span>
          <span>{formatDuration(asset.durationSec)}</span>
          <span>{formatBytes(asset.sizeBytes)}</span>
          {isMusic ? <span className="badge badge--accent">Música</span> : null}
          {missing ? (
            <span className="badge badge--danger">Archivo ausente</span>
          ) : null}
          {preparing ? <span className="badge badge--info">Preparando…</span> : null}
        </span>
      </div>
      <div className="library-row__actions">
        <button
          type="button"
          className="icon-btn"
          onClick={onPreview}
          aria-label={`Reproducir ${asset.name}`}
          title="Escuchar"
        >
          <Play size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMusic}
          aria-label={
            isMusic
              ? `Quitar ${asset.name} como música principal`
              : `Usar ${asset.name} como música principal`
          }
          title={isMusic ? 'Quitar como música principal' : 'Usar como música principal'}
        >
          <Music size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onRemove}
          aria-label={`Quitar ${asset.name} de la biblioteca`}
          title="Quitar del proyecto"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
