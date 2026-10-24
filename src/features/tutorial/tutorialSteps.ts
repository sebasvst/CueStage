import type { CueStageProject } from '../../types';

/**
 * Mini tutorial that guides a first-time user while they prepare the show.
 *
 * The steps are derived from the current state of the project, so the guide
 * advances on its own as soon as the user completes each step. Nothing has to
 * be marked as "done" by hand.
 */

export type TutorialStepId = 'archivos' | 'musica' | 'botones' | 'lista' | 'listo';

export interface TutorialStep {
  id: TutorialStepId;
  /** Position inside the guide (1..4). The final screen is not numbered. */
  index: number;
  title: string;
  text: string;
  /** Label of the button that takes the user to the right place. */
  actionLabel: string;
  /** Id of the section to scroll to when the action is pressed. */
  targetId: string;
  done: boolean;
}

const TOTAL_STEPS = 4;

export function resolveTutorialSteps(
  project: CueStageProject | null,
): TutorialStep[] {
  const hasFiles = (project?.assets.length ?? 0) > 0;
  const hasMusic = Boolean(project?.musicAssetId);
  const hasButtons = (project?.pads.length ?? 0) > 0;
  const hasList = (project?.cues.length ?? 0) > 0;

  const filesDone = hasFiles;
  const musicDone = hasMusic;
  const buttonsDone = hasButtons;
  const listDone = hasList;

  return [
    {
      id: 'archivos',
      index: 1,
      title: 'Añade tu música y tus sonidos',
      text: 'Toca «Añadir archivos» y elige los MP3, WAV u OGG de la función. Se copian dentro de la presentación y tus originales no se tocan.',
      actionLabel: 'Añadir archivos',
      targetId: 'tutorial-archivos',
      done: filesDone,
    },
    {
      id: 'musica',
      index: 2,
      title: 'Elige la música de fondo',
      text: 'De los archivos que has añadido, elige el que sonará durante toda la actuación. Los sonidos que lances se oirán encima.',
      actionLabel: 'Elegir la música',
      targetId: 'tutorial-musica',
      done: musicDone,
    },
    {
      id: 'botones',
      index: 3,
      title: 'Prepara los botones de sonido',
      text: 'Ya hay un botón por cada archivo. Solo tienes que ponerles un nombre claro y, si quieres, una tecla para lanzarlos sin mirar.',
      actionLabel: 'Ver los botones',
      targetId: 'tutorial-botones',
      done: buttonsDone,
    },
    {
      id: 'lista',
      index: 4,
      title: 'Escribe la lista de señales',
      text: 'Anota lo que va pasando en escena, en orden: «Entrada», «Caminata», «Final». En «En vivo» la recorrerás con un solo toque.',
      actionLabel: 'Escribir la lista',
      targetId: 'tutorial-lista',
      done: listDone,
    },
    {
      id: 'listo',
      index: TOTAL_STEPS,
      title: '¡Todo listo!',
      text: 'Ya puedes actuar. En «En vivo» verás los botones grandes, los volúmenes y el botón rojo para pararlo todo.',
      actionLabel: 'Ir a En vivo',
      targetId: 'tutorial-listo',
      // El paso final nunca se marca como hecho: es la confirmación de que
      // la presentación está lista para actuar.
      done: false,
    },
  ];
}

/** The step the user should be doing right now. */
export function currentTutorialStep(project: CueStageProject | null): TutorialStep {
  const steps = resolveTutorialSteps(project);
  const pending = steps.find((step) => !step.done);
  return pending ?? steps[steps.length - 1]!;
}

/** True when the presentation is ready to be performed. */
export function isProjectReady(project: CueStageProject | null): boolean {
  if (!project) return false;
  return (
    project.assets.length > 0 &&
    Boolean(project.musicAssetId) &&
    project.pads.length > 0
  );
}
