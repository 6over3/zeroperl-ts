/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
type Imports = WebAssembly.Imports;
/**
 * Options for asyncify instantiation.
 */
export interface AsyncifyOptions {
    /**
     * Export names that should not be wrapped with async handling.
     * Use this for synchronous-only functions that never trigger
     * async operations (like asyncjmp_rt_start).
     */
    unwrappedExports?: string[];
}
export declare class Instance extends WebAssembly.Instance {
    constructor(module: WebAssembly.Module, imports?: Imports, options?: AsyncifyOptions);
    get exports(): WebAssembly.Exports;
}
/**
 * Instantiate a WebAssembly module with asyncify support.
 *
 * @param source - The WebAssembly binary
 * @param imports - Import object for the module
 * @param options - Asyncify options including which exports to skip wrapping
 */
export declare function instantiate(source: ArrayBufferLike, imports?: Imports, options?: AsyncifyOptions): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
/**
 * Instantiate a WebAssembly module from a streaming source with asyncify support.
 *
 * @param source - Response or Promise of Response containing the WASM
 * @param imports - Import object for the module
 * @param options - Asyncify options including which exports to skip wrapping
 */
export declare function instantiateStreaming(source: Response | Promise<Response>, imports?: Imports, options?: AsyncifyOptions): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
export {};
