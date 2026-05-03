import { WASIAbi } from "../abi";
import type { WASIOptions } from "../options";
/**
 * A feature provider that provides `environ_get` and `environ_sizes_get`
 */
export declare function useEnviron(options: WASIOptions, abi: WASIAbi, memoryView: () => DataView): WebAssembly.ModuleImports;
