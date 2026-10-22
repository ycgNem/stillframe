import { App } from './app/app';
import { installDebugSliders } from './app/debug';
import sheetUrl from './art/sheet.png';
import sheet from './art/sheet.json';
import type { SheetJson } from './render/atlas';

const app = new App(document.getElementById('game') as HTMLCanvasElement, sheetUrl, sheet as unknown as SheetJson);
// debugging handle for e2e scripts and the console
(window as unknown as { __app: App }).__app = app;
if (new URLSearchParams(location.search).has('debug')) installDebugSliders(app);
