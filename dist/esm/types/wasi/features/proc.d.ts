import { WASIAbi } from "../abi";
import type { WASIOptions } from "../options";
/**
 * A feature provider that provides `proc_exit` and `proc_raise` by JavaScript's exception.
 */
export declare function useProc(_options: WASIOptions, _abi: WASIAbi, _memoryView: () => DataView): WebAssembly.ModuleImports;
