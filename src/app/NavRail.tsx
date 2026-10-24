import { AudioLines, House, Radio, Settings } from 'lucide-react';
import { CueStageMark } from '../components/common/Icon';
import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';
import { APP_SECTIONS, SECTION_HINTS, SECTION_LABELS, type AppSection } from '../types';

const ICONS: Record<AppSection, typeof House> = {
  inicio: House,
  estudio: AudioLines,
  'en-vivo': Radio,
  configuracion: Settings,
};

export function NavRail() {
  const section = useUiStore((state) => state.section);
  const setSection = useUiStore((state) => state.setSection);
  const project = useProjectStore((state) => state.project);
  const padCount = project?.pads.length ?? 0;

  return (
    <nav className="nav-rail" aria-label="Secciones de la aplicación">
      <div className="nav-brand">
        <span className="nav-brand__mark">
          <CueStageMark size={19} />
        </span>
        <span className="nav-brand__text">
          <span className="nav-brand__name">CueStage</span>
          <span className="nav-brand__tagline">Música y sonidos en vivo</span>
        </span>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block nav-live"
        onClick={() => setSection('en-vivo')}
        title="Ir a En vivo"
      >
        <Radio size={16} />
        <span className="nav-live__label">Ir a En vivo</span>
      </button>

      <div className="nav-items">
        {APP_SECTIONS.map((key) => {
          const Icon = ICONS[key];
          const isActive = section === key;
          return (
            <button
              key={key}
              type="button"
              className="nav-item"
              aria-current={isActive ? 'page' : undefined}
              title={SECTION_LABELS[key]}
              onClick={() => setSection(key)}
            >
              <span className="nav-item__icon">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <span className="nav-item__text">
                <span className="nav-item__label">{SECTION_LABELS[key]}</span>
                <span className="nav-item__hint">{SECTION_HINTS[key]}</span>
              </span>
              {key === 'estudio' && padCount > 0 ? (
                <span className="nav-item__badge">{padCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="nav-footer">
        {project ? (
          <div className="nav-project">
            <span className="nav-project__label">Presentación abierta</span>
            <span className="nav-project__name">{project.name}</span>
          </div>
        ) : (
          <p className="nav-project__label">Ninguna presentación abierta</p>
        )}
      </div>
    </nav>
  );
}
