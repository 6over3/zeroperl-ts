import { WASIAbi } from "../abi";
import type { WASIOptions } from "../options";
/**
 * Create a feature provider that provides `random_get` with `crypto` APIs as backend by default.
 */
export declare function useRandom(_options: WASIOptions, _abi: WASIAbi, memoryView: () => DataView): WebAssembly.ModuleImports;
