// Temporary: the V1 subprocess calls still use the Bun global. Tasks 2/4/5
// replace them with plugin-context clients, then this file can go.
declare const Bun: any
