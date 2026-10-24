import { describe, expect, it } from 'vitest';
import {
  arrayOf,
  boolean,
  enumValues,
  number,
  object,
  safeParse,
  string,
  withDefault,
} from '../../src/services/schema';
import {
  CURRENT_FORMAT_VERSION,
  migrateProject,
  projectSchema,
} from '../../src/features/projects/projectSchema';
import { createEmptyProject } from '../../src/features/projects/projectFactory';

describe('schema combinators', () => {
  it('reports the path of the invalid value', () => {
    const schema = object({ name: string({ min: 1 }) });
    const result = safeParse(schema, { name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('$.name');
    }
  });

  it('rejects a value of the wrong type', () => {
    const schema = object({ count: number({ integer: true }) });
    expect(safeParse(schema, { count: 1.5 }).ok).toBe(false);
    expect(safeParse(schema, { count: 'x' }).ok).toBe(false);
    expect(safeParse(schema, { count: 3 }).ok).toBe(true);
  });

  it('applies the default when the value is missing', () => {
    const schema = object({ flag: withDefault(boolean(), () => true) });
    const result = safeParse(schema, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flag).toBe(true);
    }
  });

  it('validates enums', () => {
    const schema = enumValues(['a', 'b'] as const);
    expect(safeParse(schema, 'a').ok).toBe(true);
    expect(safeParse(schema, 'c').ok).toBe(false);
  });

  it('validates arrays', () => {
    const schema = arrayOf(number());
    expect(safeParse(schema, [1, 2, 3]).ok).toBe(true);
    expect(safeParse(schema, [1, 'x']).ok).toBe(false);
  });
});

describe('project schema', () => {
  it('accepts a freshly created project', () => {
    const project = createEmptyProject('Mimos de Francia');
    const result = safeParse(projectSchema, project);
    expect(result.ok).toBe(true);
  });

  it('fills in the optional sections', () => {
    const project = createEmptyProject('Test');
    const raw = { ...project } as Record<string, unknown>;
    delete raw['mixer'];
    delete raw['playback'];
    delete raw['pads'];
    delete raw['cues'];
    delete raw['assets'];

    const result = safeParse(projectSchema, raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mixer.musicVolume).toBeCloseTo(0.9);
      expect(result.value.pads).toEqual([]);
    }
  });

  it('rejects a project without an identifier', () => {
    const project = createEmptyProject('Test');
    const raw = { ...project } as Record<string, unknown>;
    delete raw['id'];
    expect(safeParse(projectSchema, raw).ok).toBe(false);
  });

  it('rejects an invalid pad colour', () => {
    const project = createEmptyProject('Test');
    project.pads = [
      {
        id: 'pad-1',
        name: 'Paso',
        assetId: null,
        color: 'rojo',
        icon: 'zap',
        volume: 1,
        shortcut: null,
        mode: 'once',
        enabled: true,
      },
    ];
    expect(safeParse(projectSchema, project).ok).toBe(false);
  });

  it('rejects an out of range volume', () => {
    const project = createEmptyProject('Test');
    project.pads = [
      {
        id: 'pad-1',
        name: 'Paso',
        assetId: null,
        color: '#E0562D',
        icon: 'zap',
        volume: 4,
        shortcut: null,
        mode: 'once',
        enabled: true,
      },
    ];
    expect(safeParse(projectSchema, project).ok).toBe(false);
  });
});

describe('migrateProject', () => {
  it('accepts a project of the current format', () => {
    const project = createEmptyProject('Test');
    const migrated = migrateProject(project);
    expect(migrated.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(migrated.name).toBe('Test');
  });

  it('refuses a project written by a newer version', () => {
    const project = { ...createEmptyProject('Test'), formatVersion: 99 };
    expect(() => migrateProject(project)).toThrow(/versión más reciente/i);
  });

  it('refuses a file that is not an object', () => {
    expect(() => migrateProject('nope')).toThrow(/objeto válido/i);
  });
});
