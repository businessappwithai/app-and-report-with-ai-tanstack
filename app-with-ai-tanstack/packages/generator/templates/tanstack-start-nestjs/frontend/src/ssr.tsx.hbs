import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/start/server";
import { getRouterManifest as _getRouterManifest } from "@tanstack/start/router-manifest";
import { getRouter } from "./router";

function getRouterManifest() {
  const manifest = _getRouterManifest();
  if (process.env.NODE_ENV === 'development') {
    const root = (manifest.routes.__root__ = manifest.routes.__root__ || {});
    root.assets = root.assets || [];
    const hasPreamble = root.assets.some((a: { tag: string; children?: string }) =>
      a.tag === 'script' && a.children?.includes('injectIntoGlobalHook')
    );
    if (!hasPreamble) {
      const clientScriptIdx = root.assets.findIndex((a: { tag: string; attrs?: { src?: string } }) =>
        a.tag === 'script' && a.attrs?.src
      );
      const preamble = {
        tag: 'script' as const,
        attrs: { type: 'module' },
        children: `import RefreshRuntime from '/_build/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`,
      };
      if (clientScriptIdx >= 0) {
        root.assets.splice(clientScriptIdx, 0, preamble);
      } else {
        root.assets.push(preamble);
      }
    }
  }
  return manifest;
}

export default createStartHandler({ createRouter: getRouter, getRouterManifest })(
  defaultStreamHandler,
);
