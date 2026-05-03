import { WASIAbi } from "../abi";
import type { WASIOptions } from "../options";
/**
 * A feature provider that provides `args_get` and `args_sizes_get`
 */
export declare function useArgs(options: WASIOptions, abi: WASIAbi, memoryView: () => DataView): WebAssembly.ModuleImports;
