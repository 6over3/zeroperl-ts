import { WASIAbi } from "./abi";
export { WASIProcExit } from "./abi";
import type { WASIOptions } from "./options";
export * from "./features/args";
export * from "./features/clock";
export * from "./features/environ";
export { useFS, useStdio, useMemoryFS } from "./features/fd";
export * from "./features/proc";
export * from "./features/random";
export declare class WASI {
    /**
     * `wasiImport` is an object that implements the WASI system call API. This object
     * should be passed as the `wasi_snapshot_preview1` import during the instantiation
     * of a [`WebAssembly.Instance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Instance).
     */
    readonly wasiImport: WebAssembly.ModuleImports;
    private instance;
    private isStarted;
    abi: WASIAbi;
    constructor(options?: WASIOptions);
    get exports(): WebAssembly.Exports;
    private view;
    /**
   * Attempt to initialize `instance` as a WASI reactor by invoking its`_initialize()` export, if it is present. If `instance` contains a `_start()`export, then an exception is thrown.
   *
   * `initialize()` requires that `instance` exports a [`WebAssembly.Memory`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory) named`memory`.
   * If `instance` does not have a `memory` export an exception is thrown.
   *
   * If `initialize()` is called more than once, an exception is thrown.
   */
    initialize(instance: WebAssembly.Instance): Promise<void>;
    /**
     * Attempt to begin execution of `instance` as a WASI command by invoking its`_start()` export. If `instance` does not contain a `_start()` export, or if`instance` contains an `_initialize()`
     * export, then an exception is thrown.
     *
     * `start()` requires that `instance` exports a [`WebAssembly.Memory`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory) named`memory`. If
     * `instance` does not have a `memory` export an exception is thrown.
     *
     * If `start()` is called more than once, an exception is thrown.
     */
    start(instance: WebAssembly.Instance): Promise<number>;
}
