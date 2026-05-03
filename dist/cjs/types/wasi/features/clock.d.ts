import { WASIAbi } from "../abi";
import type { WASIOptions } from "../options";
/**
 * A feature provider that provides `clock_res_get` and `clock_time_get` by JavaScript's Date.
 */
export declare function useClock(_options: WASIOptions, _abi: WASIAbi, memoryView: () => DataView): WebAssembly.ModuleImports;
