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

const DATA_ADDR: number = 16;
const DATA_START: number = DATA_ADDR + 8;

type CallableFn = (...args: unknown[]) => unknown;
const WRAPPED_EXPORTS: WeakMap<object, object> = new WeakMap();

// Default exports that should never be wrapped
const DEFAULT_UNWRAPPED_EXPORTS = new Set(["free", "malloc"]);

enum State {
	None = 0,
	Unwinding = 1,
	Rewinding = 2,
}

interface AsyncifyExports extends WebAssembly.Exports {
	asyncify_get_state: () => number;
	asyncify_start_unwind: (addr: number) => void;
	asyncify_stop_unwind: () => void;
	asyncify_start_rewind: (addr: number) => void;
	asyncify_stop_rewind: () => void;
	memory: WebAssembly.Memory;
	__stack_pointer: WebAssembly.Global;
}

type ImportFn = (...args: unknown[]) => unknown;
type ModuleImports = WebAssembly.ModuleImports;
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

function isPromise(obj: unknown): obj is Promise<unknown> {
	return (
		!!obj &&
		(typeof obj === "object" || typeof obj === "function") &&
		typeof (obj as { then?: unknown }).then === "function"
	);
}

function proxyGet<T extends object>(obj: T, transform: (value: unknown) => unknown): T {
	return new Proxy(obj, {
		get: (obj, name: string | symbol) => {
			const value = obj[name as keyof typeof obj];
			if (value !== undefined) {
				return transform(value);
			}
			return undefined;
		},
	});
}

class Asyncify {
	private value: unknown = undefined;
	private exports: AsyncifyExports | null = null;
	private unwrappedExports: Set<string>;

	constructor(options?: AsyncifyOptions) {
		this.unwrappedExports = new Set([
			...DEFAULT_UNWRAPPED_EXPORTS,
			...(options?.unwrappedExports ?? []),
		]);
	}

	getState(): number {
		if (!this.exports) throw new Error("Exports not initialized");
		return this.exports.asyncify_get_state();
	}

	assertNoneState(): void {
		const state = this.getState();
		if (state !== State.None) {
			throw new Error(`Invalid async state ${state}, expected 0.`);
		}
	}

	wrapImportFn(fn: ImportFn): ImportFn {
		return (...args: unknown[]) => {
			if (this.getState() === State.Rewinding) {
				if (!this.exports) throw new Error("Exports not initialized");
				this.exports.asyncify_stop_rewind();
				return this.value;
			}
			this.assertNoneState();
			const value = fn(...args);
			if (!isPromise(value)) {
				return value;
			}
			if (!this.exports) throw new Error("Exports not initialized");
			this.exports.asyncify_start_unwind(DATA_ADDR);
			this.value = value;
		};
	}

	wrapModuleImports(module: ModuleImports): ModuleImports {
		return proxyGet(module, (value) => {
			if (typeof value === "function") {
				return this.wrapImportFn(value as ImportFn);
			}
			return value;
		}) as ModuleImports;
	}

	wrapImports(imports?: Imports): Imports | undefined {
		if (imports === undefined) return;
		return proxyGet(imports, (moduleImports = Object.create(null)) =>
			this.wrapModuleImports(moduleImports as ModuleImports),
		) as Imports;
	}

	wrapExportFn(fn: CallableFn): CallableFn {
		let newExport = WRAPPED_EXPORTS.get(fn) as CallableFn | undefined;
		if (newExport !== undefined) {
			return newExport;
		}

		newExport = async (...args: unknown[]) => {
			this.assertNoneState();
			let result = fn(...args);

			while (this.getState() === State.Unwinding) {
				if (!this.exports) throw new Error("Exports not initialized");
				this.exports.asyncify_stop_unwind();
				this.value = await (this.value as Promise<unknown>);
				this.assertNoneState();
				this.exports.asyncify_start_rewind(DATA_ADDR);
				result = fn(...args);
			}

			this.assertNoneState();
			return result;
		};

		WRAPPED_EXPORTS.set(fn, newExport);
		return newExport;
	}

	wrapExports(exports: WebAssembly.Exports): WebAssembly.Exports {
		const newExports = Object.create(null);

		for (const exportName in exports) {
			let value = exports[exportName];
			if (
				typeof value === "function" &&
				!exportName.startsWith("asyncify_") &&
				!this.unwrappedExports.has(exportName)
			) {
				value = this.wrapExportFn(value as CallableFn);
			}
			Object.defineProperty(newExports, exportName, {
				enumerable: true,
				value,
			});
		}

		WRAPPED_EXPORTS.set(exports, newExports);
		return newExports;
	}

	init(instance: WebAssembly.Instance, imports?: Imports): void {
		const exports = instance.exports as AsyncifyExports;
		const memory =
			exports.memory ||
			(imports?.env && (imports.env as { memory?: WebAssembly.Memory }).memory);

		if (!memory) {
			throw new Error("Memory not found in exports or imports.env");
		}

		let dataEnd: number;
		if (exports.__stack_pointer) {
			dataEnd = exports.__stack_pointer.value as number;
		} else {
			dataEnd = 1024;
		}

		new Int32Array(memory.buffer, DATA_ADDR).set([DATA_START, dataEnd]);
		this.exports = this.wrapExports(exports) as AsyncifyExports;
		Object.setPrototypeOf(instance, Instance.prototype);
	}
}

export class Instance extends WebAssembly.Instance {
	constructor(
		module: WebAssembly.Module,
		imports?: Imports,
		options?: AsyncifyOptions,
	) {
		const state = new Asyncify(options);
		super(module, state.wrapImports(imports));
		state.init(this, imports);
	}

	override get exports(): WebAssembly.Exports {
		return WRAPPED_EXPORTS.get(super.exports) as WebAssembly.Exports;
	}
}

Object.defineProperty(Instance.prototype, "exports", { enumerable: true });

/**
 * Instantiate a WebAssembly module with asyncify support.
 *
 * @param source - The WebAssembly binary
 * @param imports - Import object for the module
 * @param options - Asyncify options including which exports to skip wrapping
 */
export async function instantiate(
	source: ArrayBufferLike,
	imports?: Imports,
	options?: AsyncifyOptions,
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
	const state = new Asyncify(options);
	const result = await WebAssembly.instantiate(
		source,
		state.wrapImports(imports),
	);
	state.init(result.instance, imports);
	return result;
}

/**
 * Instantiate a WebAssembly module from a streaming source with asyncify support.
 *
 * @param source - Response or Promise of Response containing the WASM
 * @param imports - Import object for the module
 * @param options - Asyncify options including which exports to skip wrapping
 */
export async function instantiateStreaming(
	source: Response | Promise<Response>,
	imports?: Imports,
	options?: AsyncifyOptions,
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
	const state = new Asyncify(options);
	const result = await WebAssembly.instantiateStreaming(
		source,
		state.wrapImports(imports),
	);
	state.init(result.instance, imports);
	return result;
}