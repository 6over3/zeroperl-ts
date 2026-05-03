import type { WASIFeatureProvider } from "../options";
interface FdEntry {
    writev(iovs: Uint8Array[]): number;
    readv(iovs: Uint8Array[]): number;
    close(): void;
}
export declare class ReadableTextProxy implements FdEntry {
    private readonly consume;
    private encoder;
    private pending;
    constructor(consume: () => string | Uint8Array);
    writev(_iovs: Uint8Array[]): number;
    consumePending(pending: Uint8Array, requestLength: number): Uint8Array;
    readv(iovs: Uint8Array[]): number;
    close(): void;
}
export type StdIoOptions = {
    stdin?: () => string | Uint8Array;
    stdout?: (lines: string | Uint8Array) => void;
    stderr?: (lines: string | Uint8Array) => void;
    outputBuffers?: boolean;
};
/**
 * Create a feature provider that provides fd related features only for standard output and standard error
 * It uses JavaScript's `console` APIs as backend by default.
 *
 * ```js
 * const wasi = new WASI({
 *   features: [useStdio()],
 * });
 * ```
 *
 * To use a custom backend, you can pass stdout and stderr handlers.
 *
 * ```js
 * const wasi = new WASI({
 *   features: [
 *     useStdio({
 *       stdout: (lines) => document.write(lines),
 *       stderr: (lines) => document.write(lines),
 *     })
 *   ],
 * });
 * ```
 *
 * This provides `fd_write`, `fd_prestat_get` and `fd_prestat_dir_name` implementations to make libc work with minimal effort.
 */
export declare function useStdio(useOptions?: StdIoOptions): WASIFeatureProvider;
/**
 * Represents a node in the file system that is a directory.
 */
interface DirectoryNode {
    readonly type: "dir";
    entries: Record<string, FSNode>;
}
/**
 * Represents a node in the file system that is a file.
 */
interface FileNode {
    readonly type: "file";
    content: Uint8Array | Blob;
}
type CharacterDeviceNode = {
    readonly type: "character";
    kind: "stdio";
    entry: FdEntry;
} | {
    readonly type: "character";
    kind: "devnull";
};
/**
 * Union type representing any node in the file system.
 */
type FSNode = DirectoryNode | FileNode | CharacterDeviceNode;
/**
 * Type for file content that can be added to the file system.
 */
type FileContent = string | Uint8Array | Blob;
/**
 * In-memory implementation of a file system.
 */
export declare class MemoryFileSystem {
    private root;
    private preopenPaths;
    /**
     * Creates a new memory file system.
     * @param preopens Optional list of directories to pre-open
     */
    constructor(preopens?: {
        [guestPath: string]: string;
    } | undefined);
    removeFile(path: string): void;
    addFile(path: string, content: FileContent): void;
    /**
     * Creates a file with the specified content.
     * @param path Path where the file should be created
     * @param content Binary content of the file
     * @returns The created file node
     */
    createFile(path: string, content: Uint8Array | Blob): FileNode;
    /**
     * Sets a node at the specified path.
     * @param path Path where the node should be set
     * @param node The node to set
     */
    setNode(path: string, node: FSNode): void;
    /**
     * Gets the /dev/null special device.
     * @returns The /dev/null node
     */
    getDevNull(): FSNode;
    /**
     * Gets the list of pre-opened paths.
     * @returns Array of pre-opened paths
     */
    getPreopenPaths(): string[];
    /**
     * Looks up a node at the specified path.
     * @param path Path to look up
     * @returns The node at the path, or null if not found
     */
    lookup(path: string): FSNode | null;
    /**
     * Resolves a relative path from a directory.
     * @param dir Starting directory
     * @param relativePath Relative path to resolve
     * @returns The resolved node, or null if not found
     */
    resolve(dir: DirectoryNode, relativePath: string): FSNode | null;
    /**
     * Ensures a directory exists at the specified path, creating it if necessary.
     * @param path Path to the directory
     * @returns The directory node
     */
    ensureDir(path: string): DirectoryNode;
    /**
     * Creates a file in a directory.
     * @param dir Parent directory
     * @param relativePath Path relative to the directory
     * @returns The created file node
     */
    createFileIn(dir: DirectoryNode, relativePath: string): FileNode;
    /**
     * Normalizes a path by removing duplicate slashes and trailing slashes.
     * @param path Path to normalize
     * @returns Normalized path
     */
    private normalizePath;
}
/**
 * Creates a feature provider that implements a complete in-memory file system.
 *
 * This provides implementations for all file descriptor and path-related WASI
 * functions, including `fd_read`, `fd_write`, `fd_seek`, `fd_tell`, `fd_close`,
 * `path_open`, and more to support a full featured file system environment.
 *
 * ```js
 * const wasi = new WASI({
 *   features: [useMemoryFS()],
 * });
 * ```
 *
 * You can provide a pre-configured file system instance:
 *
 * ```js
 * const fs = new MemoryFileSystem();
 * fs.addFile("/hello.txt", "Hello, world!");
 *
 * const wasi = new WASI({
 *   features: [useMemoryFS({ withFileSystem: fs })],
 * });
 * ```
 *
 * You can also combine it with standard IO:
 *
 * ```js
 * const wasi = new WASI({
 *   features: [
 *     useMemoryFS({
 *       withStdIo: {
 *         stdout: (lines) => document.write(lines),
 *         stderr: (lines) => document.write(lines),
 *       }
 *     })
 *   ],
 * });
 * ```
 *
 * @param useOptions - Configuration options for the memory file system
 * @param useOptions.withFileSystem - Optional pre-configured file system instance
 * @param useOptions.withStdIo - Optional standard I/O configuration
 * @returns A WASI feature provider implementing file system functionality
 */
export declare function useMemoryFS(useOptions?: {
    withFileSystem?: MemoryFileSystem;
    withStdIo?: StdIoOptions;
}): WASIFeatureProvider;
export declare function useFS(_useOptions: {
    fs: unknown;
}): WASIFeatureProvider;
export {};
