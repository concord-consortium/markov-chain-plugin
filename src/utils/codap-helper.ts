import codapInterface from "./codap-interface";

export function initializePlugin(pluginName: string, version: string, dimensions: { width: number, height: number },
                                 iRestoreStateHandler: (arg0: any) => void) {
  const interfaceConfig = {
    name: pluginName,
    version,
    dimensions,
    preventDataContextReorg: false,
    preventBringToFront: false,
    cannotClose: false
  };
  return codapInterface.init(interfaceConfig, iRestoreStateHandler);
}
